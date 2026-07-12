/**
 * firestore-helpers.js — Düğün Planlayıcı ortak Firestore modülü
 *
 * Sağladıkları:
 * - Firebase init + auth (tek yerden)
 * - Firestore listen (hasPendingWrites kontrolü dahil)
 * - Save + otomatik versiyonlama (subcollection, throttled, retention)
 * - Global error handling (sessiz kırılma yok)
 * - Toast bildirimleri
 *
 * Kullanım:
 *   <script src="./firebase-config.js"></script>
 *   <script src="./firestore-helpers.js"></script>
 *   <script>
 *     fh.init();
 *     fh.onAuth({
 *       onLogin: (user) => { fh.listen('shared/guests', data => { ... }); },
 *       onLogout: () => { ... }
 *     });
 *   </script>
 */

const fh = (() => {
    // ---- PRIVATE STATE ----
    let _auth = null;
    let _db = null;
    let _currentUser = null;
    let _listeners = {};          // path -> unsubscribe fn
    let _lastVersionTime = {};    // path -> timestamp (throttle)

    const VERSION_THROTTLE_MS = 5 * 60 * 1000;  // 5 dakika
    const MAX_VERSIONS = 30;

    // ---- DEV / DEMO BYPASS (localhost + Firebase önizleme kanalları) ----
    // Lokalde ve geçici önizleme (preview channel) URL'lerinde Google auth +
    // Firestore rules devrede olamaz. Bu blok login'i atlar ve bellekteki mock
    // veriyi besler — gerçek Firestore verisine ASLA dokunmaz.
    // Önizleme kanalı host'u '<proje>--<kanal>-<hash>.web.app' → '--' içerir.
    // Canlı (dugun-planlayici-ff34e.web.app) '--' İÇERMEZ → mock canlıda aktif olmaz.
    const _isPreviewChannel = location.hostname.indexOf('--') !== -1 &&
        (/\.web\.app$/.test(location.hostname) || /\.firebaseapp\.com$/.test(location.hostname));
    const _DEV = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || _isPreviewChannel);
    // DEV kimliği localStorage'dan gelir → lokalde sahip ↔ editör geçişi (paylaşım testi)
    const _DEV_OWNER = { uid: '2A9tYioQs8SmZC4v6QgZ2ct4bHI2', displayName: 'İbrahim (DEV sahip)', email: 'ibrahim.koncu@gmail.com' };
    function _devUser() {
        var v = null; try { v = localStorage.getItem('wed-dev-user'); } catch (e) { }
        if (v && v.indexOf('@') > 0) return { uid: 'editor-' + v, displayName: v + ' (DEV düzenleyici)', email: v };
        return _DEV_OWNER;
    }
    let _mockListeners = {};   // path -> onData
    const _mock = _DEV ? _buildMockData() : {};
    // Düzenleyici + davet kayıtları reload'da kaybolmasın — localStorage'a kalıcı (sadece DEV)
    if (_DEV) {
        try {
            var _pe = JSON.parse(localStorage.getItem('wed-dev-editors') || 'null');
            if (_pe && _pe.editors) {
                // Seed'i localStorage ile DEĞIŞTIR: önce seed'leri temizle
                Object.keys(_mock).forEach(function (k) { if (k.indexOf('editors/') === 0 || k.indexOf('invites/') === 0) delete _mock[k]; });
                Object.keys(_pe.editors).forEach(function (em) { _mock['editors/' + em] = _pe.editors[em]; });
                Object.keys(_pe.invites || {}).forEach(function (t) { _mock['invites/' + t] = _pe.invites[t]; });
            }
        } catch (e) { }
    }
    function _persistEditors() {
        if (!_DEV) return;
        try {
            var out = { editors: {}, invites: {} };
            Object.keys(_mock).forEach(function (k) {
                if (k.indexOf('editors/') === 0) out.editors[k.slice(8)] = _mock[k];
                if (k.indexOf('invites/') === 0) out.invites[k.slice(8)] = _mock[k];
            });
            localStorage.setItem('wed-dev-editors', JSON.stringify(out));
        } catch (e) { }
    }

    function _buildMockData() {
        return {
            'shared/planner_tasks': { list: [
                { id: 't1', title: 'Mekan seçimi ve kapora', done: false, due: '2026-02-15', assignee: 'Birlikte', hint: 'Mayıs 2026 hedef', note: 'Bahçe + kapalı alan şart', subtasks: [
                    { id: 't1s1', text: 'En az 3 mekan gez', done: true },
                    { id: 't1s2', text: 'Fiyat teklifi al', done: true },
                    { id: 't1s3', text: 'Kaporayı yatır', done: false }
                ] },
                { id: 't2', title: 'Davetli listesini kesinleştir', done: false, due: '2026-03-01', assignee: 'Hilal', hint: '', note: '', subtasks: [
                    { id: 't2s1', text: 'İki ailenin listesini birleştir', done: true },
                    { id: 't2s2', text: 'Tekrarları temizle', done: false }
                ] },
                { id: 't3', title: 'Nikah memuru ve evrak', done: true, due: '2026-01-20', assignee: 'İbrahim', hint: 'Belediye', note: '', subtasks: [] },
                { id: 't4', title: 'Fotoğrafçı anlaşması', done: false, due: '2026-03-10', assignee: 'Birlikte', hint: '', note: 'Dış çekim dahil olsun', subtasks: [
                    { id: 't4s1', text: '3 fotoğrafçı portfolyosu incele', done: true },
                    { id: 't4s2', text: 'Paket + fiyat karşılaştır', done: false }
                ] },
                { id: 't5', title: 'Gelinlik & damatlık', done: false, due: '2026-04-01', assignee: 'Hilal', hint: '', note: 'Prova tarihleri ayarlanacak', subtasks: [
                    { id: 't5s1', text: 'Gelinlik provası', done: false },
                    { id: 't5s2', text: 'Damatlık ölçü', done: false }
                ] },
                { id: 't6', title: 'Davetiye tasarımı ve baskı', done: false, due: '2026-03-20', assignee: 'Birlikte', hint: '', note: '', subtasks: [] }
            ] },
            'shared/guests': { list: [
                // ── Yılmaz Ailesi (hane) — Damat ──
                { id: 'g_yil1', name: 'Ahmet Yılmaz', group: 'Yılmaz Ailesi', side: 'Damat', rsvp: 'Katilacak', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: 'Masa 1', note: 'Damadın amcası', phone: '0532 111 0001' },
                { id: 'g_yil2', name: 'Ayşe Yılmaz', group: 'Yılmaz Ailesi', side: 'Damat', rsvp: 'Katilacak', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: 'Masa 1', note: '', phone: '' },
                { id: 'g_yil3', name: 'Elif Yılmaz', group: 'Yılmaz Ailesi', side: 'Damat', rsvp: 'Katilacak', adults: 0, children: 1, total: 1, invited: 'Gonderildi', table: 'Masa 1', note: '5 yaşında', phone: '' },
                // ── Demir Ailesi (hane) — Gelin ──
                { id: 'g_dem1', name: 'Kemal Demir', group: 'Demir Ailesi', side: 'Gelin', rsvp: 'Katilacak', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: 'Masa 2', note: 'Gelinin dayısı', phone: '0532 222 0001' },
                { id: 'g_dem2', name: 'Sevgi Demir', group: 'Demir Ailesi', side: 'Gelin', rsvp: 'Katilacak', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: 'Masa 2', note: 'Vejetaryen', phone: '' },
                { id: 'g_dem3', name: 'Deniz Demir', group: 'Demir Ailesi', side: 'Gelin', rsvp: 'Beklemede', adults: 0, children: 1, total: 1, invited: 'Gonderilmedi', table: '', note: '', phone: '' },
                // ── Şahin Ailesi (hane) — Gelin ──
                { id: 'g_sah1', name: 'Osman Şahin', group: 'Şahin Ailesi', side: 'Gelin', rsvp: 'Beklemede', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: '', note: '', phone: '0532 333 0001' },
                { id: 'g_sah2', name: 'Nuray Şahin', group: 'Şahin Ailesi', side: 'Gelin', rsvp: 'Beklemede', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: '', note: '', phone: '' },
                { id: 'g_sah3', name: 'Berk Şahin', group: 'Şahin Ailesi', side: 'Gelin', rsvp: 'Beklemede', adults: 0, children: 1, total: 1, invited: 'Gonderilmedi', table: '', note: '', phone: '' },
                { id: 'g_sah4', name: 'Ece Şahin', group: 'Şahin Ailesi', side: 'Gelin', rsvp: 'Beklemede', adults: 0, children: 1, total: 1, invited: 'Gonderilmedi', table: '', note: 'Bebek — mama sandalyesi', phone: '' },
                // ── Kaya Ailesi (hane) — Damat ──
                { id: 'g_kay1', name: 'Hasan Kaya', group: 'Kaya Ailesi', side: 'Damat', rsvp: 'Katilacak', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: 'Masa 3', note: '', phone: '0532 444 0001' },
                { id: 'g_kay2', name: 'Fatma Kaya', group: 'Kaya Ailesi', side: 'Damat', rsvp: 'Katilacak', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: 'Masa 3', note: '', phone: '' },
                // ── İş Arkadaşları (hane değil, ortak grup) — Gelin ──
                { id: 'g_is1', name: 'Gökhan Er', group: 'İş Arkadaşları', side: 'Gelin', rsvp: 'Katilacak', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: 'Masa 4', note: '', phone: '0532 555 0001' },
                { id: 'g_is2', name: 'Deniz Yıldız', group: 'İş Arkadaşları', side: 'Gelin', rsvp: 'Beklemede', adults: 1, children: 0, total: 1, invited: 'Gonderilmedi', table: '', note: '', phone: '0532 555 0002' },
                // ── Grupsuz tekil davetliler ──
                { id: 'g_can', name: 'Can Öztürk', group: '', side: 'Damat', rsvp: 'Beklemede', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: '', note: 'Üniversiteden', phone: '0532 000 0003' },
                { id: 'g_zey', name: 'Zeynep Kaya', group: '', side: 'Gelin', rsvp: 'Katilmayacak', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: '', note: 'Şehir dışında — gelemeyecek', phone: '' },
                { id: 'g_bur', name: 'Burak Çelik', group: '', side: 'Damat', rsvp: 'Katilacak', adults: 1, children: 0, total: 1, invited: 'Gonderildi', table: 'Masa 4', note: '', phone: '0532 000 0006' },
                { id: 'g_mer', name: 'Merve Arslan', group: '', side: 'Gelin', rsvp: 'Beklemede', adults: 1, children: 0, total: 1, invited: 'Gonderilmedi', table: '', note: '', phone: '0532 000 0007' },
                // ── Eski usul tek kart / çok kişi (adet olarak) ──
                { id: 'g_akr', name: 'Ali & Fatma Şahin', group: 'Akrabalar', side: 'Damat', rsvp: 'Katilacak', adults: 2, children: 2, total: 4, invited: 'Gonderilmedi', table: 'Masa 5', note: 'Tek kart, 4 kişi', phone: '0532 000 0005' }
            ] },
            'shared/venues': { list: [
                { id: 'v1', name: 'Bahçe Garden Davet', instagram: 'bahcegarden', notes: 'Açık + kapalı alan var. Fiyat uygun. Otopark geniş.', favorite: true },
                { id: 'v2', name: 'Sahil Balo Salonu', instagram: 'sahilbalo', notes: 'Deniz manzaralı ama kapalı. 250 kişi.', favorite: false },
                { id: 'v3', name: 'Köşk Kır Düğünü', instagram: 'kosakkir', notes: 'Çok şık ama bütçe üstü. Yedek.', favorite: false },
                { id: 'v4', name: 'Marina Teras', instagram: 'marinateras', notes: 'Gün batımı manzarası harika. 180 kişi. Fiyat sorulacak.', favorite: false }
            ] },
            'shared/tables': { list: [
                { id: 'm1', name: 'Masa 1', capacity: 8 },
                { id: 'm2', name: 'Masa 2', capacity: 10 },
                { id: 'm3', name: 'Masa 3', capacity: 8 },
                { id: 'm4', name: 'Masa 4', capacity: 8 },
                { id: 'm5', name: 'Masa 5', capacity: 10 }
            ] },
            // Davet/claim modeli seed'i: bir aktif düzenleyici + bir bekleyen davet linki
            'editors/demo.duzenleyici@gmail.com': { via: 'seed', name: 'Demo Düzenleyici', claimedAt: Date.now() - 86400000 },
            'invites/dev-demo-token': { used: false, createdAt: Date.now(), createdBy: 'İbrahim (DEV sahip)' }
        };
    }

    // Mock veriyi ilgili listener'a tekrar yayınla (yazma sonrası canlı güncelleme)
    function _mockEmit(path) {
        const cb = _mockListeners[path];
        if (cb) cb(_mock[path] ? JSON.parse(JSON.stringify(_mock[path])) : null);
        if (path.indexOf('editors/') === 0 || path.indexOf('invites/') === 0) _persistEditors();
    }

    // ---- INIT ----
    function init() {
        if (_DEV) {
            _setupErrorHandling();
            console.warn('🔧 DEV modu: auth atlandı, mock veri aktif (sadece localhost)');
            if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _devRenderPanel); }
            else { _devRenderPanel(); }
            return;
        }
        if (!window.FIREBASE_CONFIG) {
            throw new Error('FIREBASE_CONFIG bulunamadı. firebase-config.js yüklendi mi?');
        }
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        _auth = firebase.auth();
        _db = firebase.firestore();
        // Offline persistence — internet kesilse bile veri korunur
        _db.enablePersistence({ synchronizeTabs: true }).catch(function (e) {
            if (e.code === 'failed-precondition') {
                console.warn('Persistence: birden fazla sekme açık, sadece birinde aktif');
            } else if (e.code === 'unimplemented') {
                console.warn('Persistence: bu tarayıcı desteklemiyor');
            }
        });
        // Redirect login sonrası sonucu yakala (iOS PWA fallback)
        _auth.getRedirectResult().catch(function (e) {
            console.warn('Redirect result:', e.code || e.message);
        });
        _setupErrorHandling();
    }

    // ---- AUTH ----
    function onAuth({ onLogin, onLogout, onLoading }) {
        if (_DEV) {
            var _du = _devUser();
            _currentUser = _du;
            setTimeout(function () { if (onLogin) onLogin(_du); }, 0);
            return;
        }
        if (!_auth) throw new Error('Önce fh.init() çağrılmalı');

        _auth.onAuthStateChanged(user => {
            if (user) {
                _currentUser = user;
                if (onLogin) onLogin(user);
            } else {
                _currentUser = null;
                // Tüm aktif listener'ları temizle
                Object.values(_listeners).forEach(unsub => { if (unsub) unsub(); });
                _listeners = {};
                if (onLogout) onLogout();
            }
        });
    }

    function signIn() {
        if (_DEV) { toast('DEV modunda zaten giriş yapılı', 'info'); return; }
        if (!_auth) return;
        var provider = new firebase.auth.GoogleAuthProvider();
        _auth.signInWithPopup(provider).catch(function (e) {
            // iOS PWA veya popup engellenirse redirect'e geç
            if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
                return _auth.signInWithRedirect(provider);
            }
            console.error('Sign-in error:', e);
            toast('Giriş başarısız', 'error');
        });
    }

    function signOut() {
        if (_DEV) { toast('DEV modunda çıkış devre dışı', 'info'); return; }
        if (!_auth) return;
        if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
            _auth.signOut();
        }
    }

    function currentUser() {
        return _currentUser;
    }

    // ---- LISTEN ----
    /**
     * Firestore dokümanını dinler.
     * hasPendingWrites kontrolü dahil — kendi yazmamızda re-render atlanır.
     *
     * @param {string} path - Firestore doc path, ör: 'shared/guests'
     * @param {function} onData - (data, snap) => void. data = snap.data() veya null
     * @param {object} options - { onError, includeLocalWrites }
     * @returns {function} unsubscribe
     */
    function listen(path, onData, options = {}) {
        if (_DEV) {
            _mockListeners[path] = onData;
            setTimeout(function () { _mockEmit(path); }, 30);
            return function () { delete _mockListeners[path]; };
        }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');

        // Eski listener varsa kapat
        if (_listeners[path]) {
            _listeners[path]();
        }

        const parts = path.split('/');
        const docRef = _db.collection(parts[0]).doc(parts[1]);

        const unsub = docRef.onSnapshot(snap => {
            // hasPendingWrites: true => bizim henüz commit olmamış yazmamız.
            // Zaten optimistic UI güncel, re-render gereksiz (focus korunur).
            if (snap.metadata.hasPendingWrites && !options.includeLocalWrites) return;

            const data = snap.exists ? snap.data() : null;
            onData(data, snap);
        }, err => {
            console.error('Listen error [' + path + ']:', err);
            if (options.onError) {
                options.onError(err);
            } else if (err.code === 'permission-denied') {
                // Allowlist dışı kullanıcı — loading'den çıkar, bilgilendir
                toast('Bu hesabın erişim yetkisi yok', 'error');
                var loading = document.getElementById('loading-screen');
                if (loading) loading.style.display = 'none';
                var login = document.getElementById('login-screen');
                if (login) login.style.display = 'flex';
                var bnav = document.getElementById('bnav');
                if (bnav) bnav.style.display = 'none';
                signOut();
            } else {
                toast('Bağlantı hatası', 'error');
            }
        });

        _listeners[path] = unsub;
        return unsub;
    }

    // ---- SAVE + VERSİYONLAMA ----
    /**
     * Dokümanı kaydeder + otomatik versiyonlama.
     *
     * @param {string} path - Firestore doc path, ör: 'shared/guests'
     * @param {object} data - Kaydedilecek data ({ list: [...], ... })
     * @param {object} options - { skipHistory, label }
     * @returns {Promise<void>}
     */
    async function saveDoc(path, data, options = {}) {
        if (_DEV) {
            _mock[path] = JSON.parse(JSON.stringify(data));
            _mockEmit(path);
            return;
        }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');

        const parts = path.split('/');
        const docRef = _db.collection(parts[0]).doc(parts[1]);

        // Metadata ekle — caller objesini mutate etmeden kopya oluştur
        const docData = Object.assign({}, data, {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (_currentUser) {
            docData.updatedBy = {
                uid: _currentUser.uid,
                name: _currentUser.displayName || 'Bilinmiyor'
            };
        }

        try {
            // Ana dokümanı yaz
            await docRef.set(docData);

            // Versiyonlama (throttled)
            if (!options.skipHistory) {
                _maybeCreateVersion(path, docRef, docData, options.label || 'auto');
            }
        } catch (e) {
            console.error('Save error [' + path + ']:', e);
            toast('Kaydedilemedi', 'error');
            throw e;
        }
    }

    /**
     * Throttled versiyonlama — son versiyondan 5dk geçtiyse yeni snapshot yaz.
     */
    async function _maybeCreateVersion(path, docRef, data, label, force) {
        const now = Date.now();
        const last = _lastVersionTime[path] || 0;

        if (!force && now - last < VERSION_THROTTLE_MS) return; // Henüz erken

        _lastVersionTime[path] = now;

        try {
            const historyRef = docRef.collection('history');

            // Snapshot oluştur (serverTimestamp save sonrası çözülür, local timestamp kullan)
            const versionData = {
                snapshot: _cleanForVersion(data),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                authorUid: _currentUser ? _currentUser.uid : 'unknown',
                authorName: _currentUser ? (_currentUser.displayName || 'Bilinmiyor') : 'unknown',
                itemCount: Array.isArray(data.list) ? data.list.length : 0,
                label: label
            };

            await historyRef.add(versionData);

            // Retention: 30'dan fazla varsa en eskiyi sil
            _pruneVersions(historyRef);
        } catch (e) {
            // Versiyonlama hatası ana kayıt etkilemez — sadece logla
            console.warn('Version write failed [' + path + ']:', e);
        }
    }

    /**
     * serverTimestamp gibi serialize edilemeyen alanları temizle.
     */
    function _cleanForVersion(data) {
        const clean = {};
        for (const key in data) {
            if (key === 'updatedAt' || key === 'updatedBy') continue;
            clean[key] = data[key];
        }
        return clean;
    }

    /**
     * MAX_VERSIONS'dan fazla versiyon varsa en eskileri sil.
     */
    async function _pruneVersions(historyRef) {
        try {
            const snap = await historyRef.orderBy('createdAt', 'desc').get();
            if (snap.size <= MAX_VERSIONS) return;

            const batch = _db.batch();
            let count = 0;
            snap.docs.slice(MAX_VERSIONS).forEach(doc => {
                batch.delete(doc.ref);
                count++;
            });
            if (count > 0) await batch.commit();
        } catch (e) {
            console.warn('Prune failed:', e);
        }
    }

    // ---- ADMIN RESTORE ----
    /**
     * Belirli bir versiyonu ana dokümana geri yazar.
     * Önce mevcut hali "pre-restore" olarak versiyonlar.
     * Sadece dev console'dan çağrılır: fh.adminRestore('shared/guests', 'versionDocId')
     */
    async function adminRestore(path, versionId) {
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');

        const parts = path.split('/');
        const docRef = _db.collection(parts[0]).doc(parts[1]);
        const historyRef = docRef.collection('history');

        // 1. Mevcut hali "pre-restore" olarak kaydet
        const currentSnap = await docRef.get();
        if (currentSnap.exists) {
            _lastVersionTime[path] = 0; // Throttle'ı sıfırla
            await _maybeCreateVersion(path, docRef, currentSnap.data(), 'pre-restore');
        }

        // 2. Hedef versiyonu oku
        const versionDoc = await historyRef.doc(versionId).get();
        if (!versionDoc.exists) {
            toast('Versiyon bulunamadı', 'error');
            return;
        }

        // 3. Restore et
        const restoredData = versionDoc.data().snapshot;
        restoredData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        restoredData.updatedBy = {
            uid: _currentUser ? _currentUser.uid : 'admin',
            name: 'RESTORE'
        };

        await docRef.set(restoredData);
        toast('Versiyon geri yüklendi', 'success');
    }

    // ---- HISTORY ----
    /**
     * Belirli bir doc'un versiyonlarını listeler.
     * Admin amaçlı — console'dan: fh.loadHistory('shared/guests')
     */
    async function loadHistory(path, limit = 30) {
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');

        const parts = path.split('/');
        const historyRef = _db.collection(parts[0]).doc(parts[1]).collection('history');

        const snap = await historyRef.orderBy('createdAt', 'desc').limit(limit).get();
        return snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : null
        }));
    }

    // ---- TRANSACTION: TEK ITEM GÜNCELLEME ----
    /**
     * Bir list-doc içindeki tek item'ı transaction ile güvenle günceller.
     * İki kullanıcı aynı anda farklı item'ları güncelleyebilir — birbirini ezmez.
     *
     * @param {string} path - Firestore doc path, ör: 'shared/guests'
     * @param {string} itemId - Güncellenecek item'ın id'si
     * @param {object} fields - Güncellenecek alanlar, ör: { rsvp: 'Katilacak' }
     * @returns {Promise<void>}
     */
    async function updateItemField(path, itemId, fields) {
        if (_DEV) {
            var d = _mock[path] || (_mock[path] = { list: [] });
            var i = (d.list || []).findIndex(function (it) { return it.id === itemId; });
            if (i >= 0) { d.list[i] = Object.assign({}, d.list[i], fields); _mockEmit(path); }
            return;
        }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        const parts = path.split('/');
        const ref = _db.collection(parts[0]).doc(parts[1]);
        return _db.runTransaction(function (t) {
            return t.get(ref).then(function (doc) {
                if (!doc.exists) return;
                var data = doc.data();
                var list = data.list || [];
                var idx = list.findIndex(function (item) { return item.id === itemId; });
                if (idx < 0) return;
                list[idx] = Object.assign({}, list[idx], fields);
                t.set(ref, {
                    list: list,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: _currentUser ? { uid: _currentUser.uid, name: _currentUser.displayName || 'Bilinmiyor' } : null
                }, { merge: true });
            });
        }).catch(function (e) {
            console.error('Transaction failed [' + path + ']:', e);
            toast('Kaydedilemedi, tekrar deneyin', 'error');
            throw e; // Caller'a hatayı ilet (rollback yapabilmesi için)
        });
    }

    // ---- TRANSACTION: ITEM EKLE ----
    /**
     * Bir list-doc'a yeni item ekler — transaction ile güvenli.
     * Eş zamanlı yazma sırasında diğer kullanıcının değişikliği korunur.
     */
    async function addItem(path, newItem) {
        if (_DEV) {
            var d = _mock[path] || (_mock[path] = { list: [] });
            (d.list || (d.list = [])).push(newItem);
            _mockEmit(path);
            return;
        }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        var parts = path.split('/');
        var ref = _db.collection(parts[0]).doc(parts[1]);
        return _db.runTransaction(function (t) {
            return t.get(ref).then(function (doc) {
                var list = (doc.exists && doc.data().list) ? doc.data().list : [];
                list.push(newItem);
                t.set(ref, {
                    list: list,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: _currentUser ? { uid: _currentUser.uid, name: _currentUser.displayName || 'Bilinmiyor' } : null
                }, { merge: true });
            });
        }).catch(function (e) {
            console.error('addItem failed [' + path + ']:', e);
            toast('Eklenemedi, tekrar deneyin', 'error');
            throw e;
        });
    }

    // ---- TRANSACTION: ITEM SİL ----
    /**
     * Bir list-doc'tan item siler — transaction ile güvenli.
     * Eş zamanlı yazma sırasında diğer kullanıcının değişikliği korunur.
     */
    async function removeItem(path, itemId) {
        if (_DEV) {
            var d = _mock[path];
            if (d && d.list) { d.list = d.list.filter(function (it) { return it.id !== itemId; }); _mockEmit(path); }
            return;
        }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        var parts = path.split('/');
        var ref = _db.collection(parts[0]).doc(parts[1]);
        return _db.runTransaction(function (t) {
            return t.get(ref).then(function (doc) {
                if (!doc.exists) return;
                var list = doc.data().list || [];
                list = list.filter(function (item) { return item.id !== itemId; });
                t.set(ref, {
                    list: list,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: _currentUser ? { uid: _currentUser.uid, name: _currentUser.displayName || 'Bilinmiyor' } : null
                }, { merge: true });
            });
        }).catch(function (e) {
            console.error('removeItem failed [' + path + ']:', e);
            toast('Silinemedi, tekrar deneyin', 'error');
            throw e;
        });
    }

    // ---- TRANSACTION: LİSTE SIRALAMA ----
    /**
     * List-doc'taki item sıralamasını transaction ile güvenle günceller.
     * Drag-drop sonrası kullanılır — eş zamanlı ekleme/silme korunur.
     */
    async function reorderList(path, orderedIds) {
        if (_DEV) {
            var d = _mock[path];
            if (d && d.list) {
                var idMap = {};
                d.list.forEach(function (it) { idMap[it.id] = it; });
                var reordered = [];
                orderedIds.forEach(function (id) { if (idMap[id]) { reordered.push(idMap[id]); delete idMap[id]; } });
                Object.keys(idMap).forEach(function (id) { reordered.push(idMap[id]); });
                d.list = reordered;
                _mockEmit(path);
            }
            return;
        }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        var parts = path.split('/');
        var ref = _db.collection(parts[0]).doc(parts[1]);
        return _db.runTransaction(function (t) {
            return t.get(ref).then(function (doc) {
                if (!doc.exists) return;
                var currentList = doc.data().list || [];
                // Sıralamayı orderedIds'e göre yap, yeni eklenen/silinenleri koru
                var idMap = {};
                currentList.forEach(function (item) { idMap[item.id] = item; });
                var reordered = [];
                orderedIds.forEach(function (id) {
                    if (idMap[id]) { reordered.push(idMap[id]); delete idMap[id]; }
                });
                // orderedIds'te olmayan yeni item'ları sona ekle (eş zamanlı ekleme koruması)
                Object.keys(idMap).forEach(function (id) { reordered.push(idMap[id]); });
                t.set(ref, {
                    list: reordered,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: _currentUser ? { uid: _currentUser.uid, name: _currentUser.displayName || 'Bilinmiyor' } : null
                }, { merge: true });
            });
        }).catch(function (e) {
            console.error('reorderList failed [' + path + ']:', e);
            toast('Sıralama kaydedilemedi', 'error');
        });
    }

    // ---- TOAST ----
    function toast(message, type = 'info') {
        // Container yoksa oluştur
        let container = document.getElementById('fh-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'fh-toast-container';
            container.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none';
            document.body.appendChild(container);
        }

        const colors = {
            info: '#475569',
            success: '#16a34a',
            error: '#dc2626',
            warning: '#d97706'
        };

        const el = document.createElement('div');
        el.style.cssText = 'padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;color:white;background:' + (colors[type] || colors.info) + ';box-shadow:0 4px 12px rgba(0,0,0,0.15);opacity:0;transition:opacity 0.3s;pointer-events:auto';
        el.textContent = message;
        container.appendChild(el);

        requestAnimationFrame(() => { el.style.opacity = '1'; });
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 2500);
    }

    // ---- ERROR HANDLING ----
    function _setupErrorHandling() {
        window.addEventListener('error', e => {
            console.error('Uncaught error:', e.error || e.message);
            toast('Beklenmeyen hata: ' + (e.message || '').substring(0, 60), 'error');
        });

        window.addEventListener('unhandledrejection', e => {
            console.error('Unhandled rejection:', e.reason);
            toast('İşlem başarısız', 'error');
        });
    }

    // ---- UTILITY ----
    /**
     * HTML escape — XSS koruması
     */
    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    /**
     * Manuel versiyon oluştur — throttle bypass.
     * Backup butonu gibi kullanıcı aksiyonları için.
     */
    async function forceVersion(path, label) {
        if (_DEV) { toast('DEV modunda yedek alınmaz', 'info'); return; }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        const parts = path.split('/');
        const docRef = _db.collection(parts[0]).doc(parts[1]);
        const snap = await docRef.get();
        if (!snap.exists) throw new Error('Döküman bulunamadı: ' + path);
        await _maybeCreateVersion(path, docRef, snap.data(), label || 'Manuel', true);
    }

    // ---- TEK SEFERLİK DAVET + DÜZENLEYİCİLER ----
    // Model: sahip invites/{token} oluşturur (7 gün geçerli). Linke tıklayan
    // İLK kişi daveti "sahiplenir": tek atomik batch'te invite used:true olur
    // + editors/{kendi-eposta} kaydı oluşur. Rules bu batch'i şart koşar —
    // aynı link ikinci kez KULLANILAMAZ. Erişim kesme = editors doc silme.
    var INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // rules'daki duration.value(7,'d') ile aynı

    function _genToken() {
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }

    // createdAt → epoch ms (Firestore Timestamp veya mock number)
    function _toMs(v) {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        return v.toMillis ? v.toMillis() : 0;
    }

    function inviteExpired(invite) {
        var ms = _toMs(invite && invite.createdAt);
        return !ms || (Date.now() - ms) > INVITE_TTL_MS;
    }

    // Sahip: yeni davet linki oluştur → token döner
    async function createInvite() {
        var token = _genToken();
        var doc = { used: false, createdBy: _currentUser ? (_currentUser.displayName || _currentUser.email) : '' };
        if (_DEV) {
            _mock['invites/' + token] = Object.assign({ createdAt: Date.now() }, doc);
            _persistEditors();
            return token;
        }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await _db.collection('invites').doc(token).set(doc);
        return token;
    }

    // Sahip: bekleyen davetler (kullanılmamış; süresi dolanlar sessizce temizlenir)
    async function listPendingInvites() {
        var all;
        if (_DEV) {
            all = Object.keys(_mock)
                .filter(function (k) { return k.indexOf('invites/') === 0; })
                .map(function (k) { return Object.assign({ token: k.slice(8) }, _mock[k]); });
        } else {
            if (!_db) throw new Error('Önce fh.init() çağrılmalı');
            var snap = await _db.collection('invites').get();
            all = snap.docs.map(function (d) { return Object.assign({ token: d.id }, d.data()); });
        }
        var pending = [];
        for (var i = 0; i < all.length; i++) {
            var inv = all[i];
            if (inv.used) continue;                       // sahiplenilenler editör listesinde görünür
            if (inviteExpired(inv)) { deleteInvite(inv.token); continue; }  // süresi dolan çöpe
            pending.push(inv);
        }
        pending.sort(function (a, b) { return _toMs(b.createdAt) - _toMs(a.createdAt); });
        return pending;
    }

    async function deleteInvite(token) {
        if (_DEV) { delete _mock['invites/' + token]; _persistEditors(); return; }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        await _db.collection('invites').doc(token).delete();
    }

    // Sahip: aktif düzenleyiciler
    async function listEditors() {
        if (_DEV) {
            return Object.keys(_mock)
                .filter(function (k) { return k.indexOf('editors/') === 0; })
                .map(function (k) { return Object.assign({ email: k.slice(8) }, _mock[k]); });
        }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        var snap = await _db.collection('editors').get();
        return snap.docs.map(function (d) { return Object.assign({ email: d.id }, d.data()); });
    }

    async function removeEditor(email) {
        if (_DEV) { delete _mock['editors/' + email]; _persistEditors(); return; }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        await _db.collection('editors').doc(email).delete();
    }

    // Giriş yapan kişi: kendi editör kaydı var mı? (rol tespiti — rules self-get izni)
    async function getMyEditorDoc() {
        var email = _currentUser && _currentUser.email ? _currentUser.email.toLowerCase() : null;
        if (!email) return null;
        if (_DEV) return _mock['editors/' + email] || null;
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        var snap = await _db.collection('editors').doc(email).get();
        return snap.exists ? snap.data() : null;
    }

    // Davet sahiplenme. Dönüş: {ok:true} | {ok:false, reason:'expired'|'error'}
    // 'expired' = link yok / kullanılmış / süresi geçmiş / yarışta kaybetti —
    // kullanıcıya hepsi "linkin süresi dolmuş, yeni link isteyin" olarak gösterilir.
    async function claimInvite(token) {
        var email = _currentUser && _currentUser.email ? _currentUser.email.toLowerCase() : null;
        if (!token || !email) return { ok: false, reason: 'error' };
        if (_DEV) {
            var inv = _mock['invites/' + token];
            if (!inv || inv.used || inviteExpired(inv)) return { ok: false, reason: 'expired' };
            inv.used = true; inv.claimedBy = email; inv.claimedAt = Date.now();
            _mock['editors/' + email] = { via: token, name: _currentUser.displayName || email, claimedAt: Date.now() };
            _persistEditors();
            return { ok: true };
        }
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        var inviteRef = _db.collection('invites').doc(token);
        var snap;
        try { snap = await inviteRef.get(); } catch (e) { return { ok: false, reason: 'error' }; }
        if (!snap.exists) return { ok: false, reason: 'expired' };
        var d = snap.data();
        if (d.used || inviteExpired(d)) return { ok: false, reason: 'expired' };
        try {
            var batch = _db.batch();
            batch.update(inviteRef, {
                used: true, claimedBy: email,
                claimedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            batch.set(_db.collection('editors').doc(email), {
                via: token, name: _currentUser.displayName || email,
                claimedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();
            return { ok: true };
        } catch (e) {
            // permission-denied: yarışı kaybetti ya da bu arada süresi doldu/kullanıldı
            console.warn('Claim başarısız:', e.code || e.message);
            return { ok: false, reason: 'expired' };
        }
    }

    // v0.9 → v0.10 geçişi: eski shared/editors {emails:[...]} varsa
    // e-postaları editors/{email} kayıtlarına taşı, eski doc'u sil.
    // Sahip modalı ilk açtığında bir kez çalışır; erişim kesintisi olmaz.
    async function migrateLegacyEditors() {
        if (_DEV) return;
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        var ref = _db.collection('shared').doc('editors');
        var snap = await ref.get();
        if (!snap.exists) return;
        var emails = snap.data().emails || [];
        for (var i = 0; i < emails.length; i++) {
            var em = String(emails[i]).toLowerCase();
            await _db.collection('editors').doc(em).set({
                via: 'legacy', name: em,
                claimedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        await ref.delete();
        if (emails.length) console.info('Eski düzenleyici listesi taşındı:', emails.join(', '));
    }

    // ---- DEV KİMLİK PANELİ (sadece localhost) ----
    function _devSwitch(v) { try { if (v) localStorage.setItem('wed-dev-user', v); else localStorage.removeItem('wed-dev-user'); } catch (e) { } location.reload(); }
    function _devRenderPanel() {
        if (!_DEV) return;
        var el = document.getElementById('fh-dev-panel');
        if (!el) { el = document.createElement('div'); el.id = 'fh-dev-panel'; el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:100000;font:12px/1.3 system-ui'; document.body.appendChild(el); }
        var open = false; try { open = localStorage.getItem('wed-dev-open') === '1'; } catch (e) { }
        var emails = {};
        Object.keys(_mock).filter(function (k) { return k.indexOf('editors/') === 0; }).forEach(function (k) { emails[k.slice(8)] = 1; });
        var cur = ''; try { cur = localStorage.getItem('wed-dev-user') || 'owner'; } catch (e) { cur = 'owner'; }
        if (!open) { el.innerHTML = '<button onclick="fh._devToggle()" style="background:#111827;color:#fff;border:none;border-radius:20px;padding:6px 11px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer;opacity:.85">🔧 DEV</button>'; return; }
        var opts = '<option value="owner"' + (cur === 'owner' ? ' selected' : '') + '>İbrahim (sahip)</option>';
        Object.keys(emails).forEach(function (e) { opts += '<option value="' + e + '"' + (cur === e ? ' selected' : '') + '>' + e + ' (düzenleyici)</option>'; });
        el.innerHTML = '<div style="background:#111827;color:#fff;border-radius:10px;padding:8px 10px;box-shadow:0 6px 20px rgba(0,0,0,.4);width:220px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-weight:700">🔧 DEV — yerel test</span><button onclick="fh._devToggle()" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer">▾</button></div>' +
            '<div style="opacity:.8;margin-bottom:6px">Canlıya bağlı değil</div>' +
            '<select onchange="fh._devSwitch(this.value)" style="width:100%;padding:4px;border-radius:6px;border:none">' + opts + '</select>' +
            '</div>';
    }
    function _devToggle() { try { var o = localStorage.getItem('wed-dev-open') === '1'; localStorage.setItem('wed-dev-open', o ? '0' : '1'); } catch (e) { } _devRenderPanel(); }

    // ---- PUBLIC API ----
    return {
        init,
        onAuth,
        signIn,
        signOut,
        currentUser,
        listen,
        saveDoc,
        adminRestore,
        loadHistory,
        forceVersion,
        updateItemField,
        addItem,
        removeItem,
        reorderList,
        createInvite,
        listPendingInvites,
        deleteInvite,
        inviteExpired,
        listEditors,
        removeEditor,
        getMyEditorDoc,
        claimInvite,
        migrateLegacyEditors,
        _devSwitch,
        _devToggle,
        toast,
        esc,
        // Internal erişim (gerektiğinde)
        get db() { return _db; },
        get auth() { return _auth; }
    };
})();
