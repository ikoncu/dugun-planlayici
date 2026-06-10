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
    let _weddingId = null;        // aktif düğün doc id
    let _weddingData = null;      // aktif düğün doc içeriği (canlı)

    const VERSION_THROTTLE_MS = 5 * 60 * 1000;  // 5 dakika
    const MAX_VERSIONS = 30;

    // v0.x tek-çift dönemi UID'leri — legacy shared/* verisinin sahipleri.
    // Migration sırasında her ikisi de yeni düğün alanına üye yapılır.
    const LEGACY_MEMBER_UIDS = ['2A9tYioQs8SmZC4v6QgZ2ct4bHI2', 'xJt5BecC3yQLAIxFGGTvj3gs37m1'];

    // Doc path çözümleme — 'shared/guests' gibi 2 segment veya
    // 'weddings/{id}/data/guests' gibi daha derin path'ler desteklenir.
    function _docRef(path) {
        return _db.doc(path);
    }

    // ---- INIT ----
    function init() {
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
        if (!_auth) throw new Error('Önce fh.init() çağrılmalı');

        _auth.onAuthStateChanged(user => {
            if (user) {
                _currentUser = user;
                if (onLogin) onLogin(user);
            } else {
                _currentUser = null;
                _weddingId = null;
                _weddingData = null;
                // Tüm aktif listener'ları temizle
                Object.values(_listeners).forEach(unsub => { if (unsub) unsub(); });
                _listeners = {};
                if (onLogout) onLogout();
            }
        });
    }

    function signIn() {
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
        if (!_auth) return;
        if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
            _auth.signOut();
        }
    }

    function currentUser() {
        return _currentUser;
    }

    // ---- DÜĞÜN BAĞLAMI (v0.7+) ----
    /**
     * Login sonrası kullanıcının üye olduğu düğünü bulur.
     * Bulursa weddingId döner ve düğün dokümanını canlı dinlemeye başlar.
     * Bulamazsa null döner — UI kurulum ekranı gösterir.
     */
    async function resolveWedding() {
        if (_weddingId) return _weddingId;
        if (!_currentUser) return null;
        const q = await _db.collection('weddings')
            .where('memberUids', 'array-contains', _currentUser.uid)
            .limit(1).get();
        if (q.empty) return null;
        _weddingId = q.docs[0].id;
        _weddingData = q.docs[0].data();
        // Düğün bilgisi (tarih/mekan/isimler) değişirse canlı güncelle
        _db.collection('weddings').doc(_weddingId).onSnapshot(s => {
            if (s.exists) _weddingData = s.data();
        }, e => console.warn('Wedding listen:', e));
        return _weddingId;
    }

    function weddingId() { return _weddingId; }
    function wedding() { return _weddingData; }

    /**
     * Düğün içi veri dokümanı path'i: fh.path('guests') →
     * 'weddings/{id}/data/guests'
     */
    function path(name) {
        if (!_weddingId) throw new Error('Düğün alanı henüz yüklenmedi (resolveWedding çağrılmadı)');
        return 'weddings/' + _weddingId + '/data/' + name;
    }

    /** Düğün dokümanındaki alanları günceller (tarih, mekan, isimler...) */
    async function updateWedding(fields) {
        if (!_weddingId) throw new Error('Düğün alanı yok');
        await _db.collection('weddings').doc(_weddingId).set(fields, { merge: true });
        _weddingData = Object.assign({}, _weddingData, fields);
    }

    /**
     * Düğün alanı kurulumu + nişan (legacy shared/*) verilerinin taşınması.
     * - Davetliler: RSVP/davetiye/masa sıfırlanarak taşınır, orijinal liste
     *   data/nisan_arsiv olarak saklanır (shared/* da dokunulmadan kalır).
     * - Görevler: açık görevler taşınır, tam liste data/nisan_gorev_arsiv'e.
     * - Masalar taşınmaz (yeni mekan krokisine göre sıfırdan kurulacak).
     * Veri kaybı yok: hiçbir legacy doc silinmez/değiştirilmez.
     */
    async function setupWedding() {
        if (!_currentUser) throw new Error('Giriş gerekli');
        const isLegacy = LEGACY_MEMBER_UIDS.indexOf(_currentUser.uid) >= 0;
        const memberUids = isLegacy ? LEGACY_MEMBER_UIDS.slice() : [_currentUser.uid];

        // Legacy verileri oku (erişim yoksa / yoksa sessizce boş geç)
        let legacyGuests = null, legacyTasks = null, legacyDates = null;
        if (isLegacy) {
            try { const s = await _db.doc('shared/guests').get(); if (s.exists) legacyGuests = s.data().list || null; } catch (e) { console.warn('Legacy guests okunamadı:', e); }
            try { const s = await _db.doc('shared/planner_tasks').get(); if (s.exists) legacyTasks = s.data().list || null; } catch (e) { console.warn('Legacy tasks okunamadı:', e); }
            try { const s = await _db.doc('shared/dates').get(); if (s.exists) legacyDates = s.data(); } catch (e) { /* yoksa varsayılan */ }
        }

        const wref = _db.collection('weddings').doc();
        await wref.set({
            coupleNames: isLegacy ? 'Hilal & İbrahim' : (_currentUser.displayName || 'Çiftimiz'),
            weddingDate: isLegacy ? '2026-09-10' : ((legacyDates && legacyDates.dugun) || ''),
            venue: isLegacy ? 'MSM Erikçe' : '',
            memberUids: memberUids,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: { uid: _currentUser.uid, name: _currentUser.displayName || '' }
        });

        const dataCol = wref.collection('data');

        if (legacyGuests && legacyGuests.length) {
            // Nişan listesi arşivi — orijinal RSVP'ler korunur
            await dataCol.doc('nisan_arsiv').set({
                list: legacyGuests,
                archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
                note: 'Nişan davetli listesi (16 Mayıs 2026) — RSVP durumlarıyla arşivlendi'
            });
            // Düğün listesi — RSVP/davetiye/masa sıfırlanır
            const resetGuests = legacyGuests.map(g => Object.assign({}, g, {
                rsvp: 'Beklemede',
                invited: 'Gonderilmedi',
                table: '',
                rsvpToken: null,
                rsvpRespondedAt: null,
                rsvpNote: ''
            }));
            await dataCol.doc('guests').set({
                list: resetGuests,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: { uid: _currentUser.uid, name: _currentUser.displayName || '' }
            });
        }

        if (legacyTasks && legacyTasks.length) {
            await dataCol.doc('nisan_gorev_arsiv').set({
                list: legacyTasks,
                archivedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Sadece açık görevler düğün listesine taşınır
            const openTasks = legacyTasks.filter(t => {
                if (t.subtasks && t.subtasks.length > 0) {
                    return !t.subtasks.every(s => s.done);
                }
                return !t.done;
            });
            await dataCol.doc('tasks').set({
                list: openTasks,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: { uid: _currentUser.uid, name: _currentUser.displayName || '' }
            });
        }

        _weddingId = wref.id;
        const snap = await wref.get();
        _weddingData = snap.data();
        return _weddingId;
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
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');

        // Eski listener varsa kapat
        if (_listeners[path]) {
            _listeners[path]();
        }

        const docRef = _docRef(path);

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
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');

        const docRef = _docRef(path);

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

        const docRef = _docRef(path);
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

        const historyRef = _docRef(path).collection('history');

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
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        const ref = _docRef(path);
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
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        var ref = _docRef(path);
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
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        var ref = _docRef(path);
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
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        var ref = _docRef(path);
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
        if (!_db) throw new Error('Önce fh.init() çağrılmalı');
        const docRef = _docRef(path);
        const snap = await docRef.get();
        if (!snap.exists) throw new Error('Döküman bulunamadı: ' + path);
        await _maybeCreateVersion(path, docRef, snap.data(), label || 'Manuel', true);
    }

    // ---- PUBLIC API ----
    return {
        init,
        onAuth,
        signIn,
        signOut,
        currentUser,
        resolveWedding,
        weddingId,
        wedding,
        path,
        updateWedding,
        setupWedding,
        listen,
        saveDoc,
        adminRestore,
        loadHistory,
        forceVersion,
        updateItemField,
        addItem,
        removeItem,
        reorderList,
        toast,
        esc,
        // Internal erişim (gerektiğinde)
        get db() { return _db; },
        get auth() { return _auth; }
    };
})();
