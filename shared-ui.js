/**
 * shared-ui.js — Ortak görsel bileşenler
 * fh (firestore-helpers.js) = veri katmanı
 * UI (shared-ui.js) = görsel katman
 *
 * Yeni sayfa eklemek: PAGES dizisine 1 satır ekle, yeni HTML dosyası oluştur.
 */
window.UI = (function () {
    // ── Sayfa Tanımları ──────────────────────────────────────────
    const PAGES = [
        { id: 'index',      path: 'index.html',      title: 'Ana Sayfa',   icon: '🏠', bnavIcon: '🏠', bnav: true,  drawer: true },
        { id: 'gorevler',   path: 'gorevler.html',    title: 'Görevler',    icon: '📋', bnavIcon: '✅', bnav: true,  drawer: true },
        { id: 'mekanlar',   path: 'mekanlar.html',    title: 'Mekanlar',    icon: '🏛️', bnavIcon: '🏛️', bnav: true,  drawer: true },
        { id: 'davetliler', path: 'davetliler.html',  title: 'Davetliler',  icon: '👥', bnavIcon: '👥', bnav: true,  drawer: true },
        { id: 'masa-plani', path: 'masa-plani.html',  title: 'Masa Planı',  icon: '🪑', bnavIcon: '🪑', bnav: true,  drawer: true },
    ];

    var _currentUser = null;

    // ── XSS Escape ───────────────────────────────────────────────
    function esc(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ── Türkçe Etiket Dönüşümü ─────────────────────────────────
    var TR_LABELS = {
        'Ibrahim':'İbrahim','Hilal':'Hilal','Birlikte':'Birlikte',
        'Katilacak':'Katılacak','Katilmayacak':'Katılmayacak','Beklemede':'Beklemede',
        'Gonderildi':'Gönderildi','Gonderilmedi':'Gönderilmedi'
    };
    function trLabel(s) { return TR_LABELS[s] || s; }

    // ── Drawer Toggle ────────────────────────────────────────────
    function toggleDrawer() {
        var isOpen = document.getElementById('drawer').classList.toggle('open');
        document.getElementById('drawer-overlay').classList.toggle('open');
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    // ── Inject: Login Ekranı ─────────────────────────────────────
    function injectLogin(title, subtitle) {
        var el = document.getElementById('login-screen');
        if (!el) return;
        el.innerHTML =
            '<div class="login-card">' +
                '<div class="logo">💍</div>' +
                '<h1>' + esc(title || 'Düğün Planlayıcı') + '</h1>' +
                '<p>' + esc(subtitle || 'Planınıza erişin') + '</p>' +
                '<button class="google-btn" onclick="fh.signIn()">' +
                    '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>' +
                    'Google ile Giriş Yap' +
                '</button>' +
            '</div>';
    }

    // ── Inject: Loading Spinner ──────────────────────────────────
    function injectLoading() {
        var el = document.getElementById('loading-screen');
        if (!el) return;
        el.innerHTML =
            '<div class="spinner"></div>' +
            '<div style="font-size:14px;color:var(--gray-500)">Yükleniyor...</div>';
    }

    // ── Inject: Bottom Nav (4 link, Ana Sayfa hariç) ─────────────
    function injectBnav(pageId) {
        var el = document.getElementById('bnav');
        if (!el) return;
        var html = '';
        PAGES.forEach(function (p) {
            if (!p.bnav) return;
            var cls = p.id === pageId ? ' class="active"' : '';
            var label = p.title === 'Masa Planı' ? 'Masa' : p.title;
            html += '<a' + cls + ' href="' + p.path + '"><span class="bicon">' + p.bnavIcon + '</span>' + label + '</a>';
        });
        el.innerHTML = html;
    }

    // ── Inject: Drawer (profil üstte, çıkış altta) ──────────────
    function injectDrawer(pageId) {
        // Overlay
        var overlay = document.getElementById('drawer-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'drawer-overlay';
            overlay.id = 'drawer-overlay';
            overlay.onclick = toggleDrawer;
            document.body.appendChild(overlay);
        }
        // Drawer
        var drawer = document.getElementById('drawer');
        if (!drawer) {
            drawer = document.createElement('div');
            drawer.className = 'drawer';
            drawer.id = 'drawer';
            document.body.appendChild(drawer);
        }
        // Profil bölümü (auth sonrası güncellenir)
        var html = '<div class="drawer-profile" id="drawer-profile">' +
            '<div class="dp-avatar" id="dp-avatar"></div>' +
            '<div class="dp-name" id="dp-name">Yükleniyor...</div>' +
        '</div>';
        // Sayfa linkleri
        html += '<div class="drawer-section">Sayfalar</div>';
        PAGES.forEach(function (p) {
            if (!p.drawer) return;
            var cls = p.id === pageId ? ' active' : '';
            html += '<a class="drawer-item' + cls + '" href="' + p.path + '"><span class="di-icon">' + p.icon + '</span>' + p.title + '</a>';
        });
        // Çıkış butonu en altta
        html += '<div class="drawer-spacer"></div>';
        html += '<button class="drawer-logout" onclick="fh.signOut()">Çıkış Yap</button>';

        drawer.innerHTML = html;
    }

    // ── Drawer'daki profili güncelle ─────────────────────────────
    function _updateDrawerProfile(user) {
        var avatar = document.getElementById('dp-avatar');
        var name = document.getElementById('dp-name');
        if (!avatar || !name) return;
        if (user.photoURL) {
            avatar.innerHTML = '<img class="dp-img" src="' + user.photoURL + '" referrerpolicy="no-referrer">';
        } else {
            var init = (user.displayName || user.email || '?')[0].toUpperCase();
            avatar.innerHTML = '<div class="dp-fallback">' + init + '</div>';
        }
        name.textContent = user.displayName || user.email || '';
    }

    // ── Auth Flow ────────────────────────────────────────────────
    function setupAuth(config) {
        fh.init();
        fh.onAuth({
            onLogin: function (user) {
                _currentUser = user;
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('loading-screen').style.display = 'flex';
                var bnav = document.getElementById('bnav');
                if (bnav) bnav.style.display = 'flex';
                _updateDrawerProfile(user);
                if (config && config.onLogin) config.onLogin(user);
            },
            onLogout: function () {
                _currentUser = null;
                document.getElementById('loading-screen').style.display = 'none';
                document.getElementById('app').style.display = 'none';
                var bnav = document.getElementById('bnav');
                if (bnav) bnav.style.display = 'none';
                document.getElementById('login-screen').style.display = 'flex';
            }
        });
    }

    // ── Show App (veri yüklenince çağrılır) ──────────────────────
    function showApp() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
    }

    // ── Public API ───────────────────────────────────────────────
    return {
        PAGES: PAGES,
        esc: esc,
        trLabel: trLabel,
        toggleDrawer: toggleDrawer,
        injectLogin: injectLogin,
        injectLoading: injectLoading,
        injectBnav: injectBnav,
        injectDrawer: injectDrawer,
        setupAuth: setupAuth,
        showApp: showApp
    };
})();
