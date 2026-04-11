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
        { id: 'index',      path: 'index.html',      title: 'Ana Sayfa',   icon: '🏠', bnavIcon: '🏠', bnav: true, drawer: true },
        { id: 'gorevler',   path: 'gorevler.html',    title: 'Görevler',    icon: '📋', bnavIcon: '✅', bnav: true, drawer: true },
        { id: 'mekanlar',   path: 'mekanlar.html',    title: 'Mekanlar',    icon: '🏛️', bnavIcon: '🏛️', bnav: true, drawer: true },
        { id: 'davetliler', path: 'davetliler.html',  title: 'Davetliler',  icon: '👥', bnavIcon: '👥', bnav: true, drawer: true },
        { id: 'masa-plani', path: 'masa-plani.html',  title: 'Masa Planı',  icon: '🪑', bnavIcon: '🪑', bnav: true, drawer: true },
    ];

    // ── XSS Escape ───────────────────────────────────────────────
    function esc(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ── Avatar ───────────────────────────────────────────────────
    function renderAvatar(user) {
        const c = document.getElementById('user-avatar-container');
        const n = document.getElementById('user-name');
        if (!c) return;
        if (user.photoURL) {
            c.innerHTML = '<img class="user-avatar" src="' + user.photoURL + '" referrerpolicy="no-referrer">';
        } else {
            const init = (user.displayName || user.email || '?')[0].toUpperCase();
            c.innerHTML = '<div class="user-avatar-fallback">' + init + '</div>';
        }
        if (n) n.textContent = user.displayName || user.email || '';
    }

    // ── Drawer Toggle ────────────────────────────────────────────
    function toggleDrawer() {
        document.getElementById('drawer').classList.toggle('open');
        document.getElementById('drawer-overlay').classList.toggle('open');
    }

    // ── Dropdown Toggle ──────────────────────────────────────────
    function toggleDropdown() {
        document.getElementById('user-dropdown').classList.toggle('open');
    }

    // Outside-click: dropdown kapat
    document.addEventListener('click', function (e) {
        var dd = document.getElementById('user-dropdown');
        if (dd && dd.classList.contains('open')) {
            if (!e.target.closest('#user-avatar-container') && !e.target.closest('.user-dropdown')) {
                dd.classList.remove('open');
            }
        }
    });

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
            '<div style="font-size:14px;color:var(--g500,#6b7280)">Yükleniyor...</div>';
    }

    // ── Inject: Bottom Nav ───────────────────────────────────────
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

    // ── Inject: Drawer ───────────────────────────────────────────
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
        var html = '<div class="drawer-header">💍 Düğün Planlayıcı</div>';
        html += '<div class="drawer-section">Sayfalar</div>';
        PAGES.forEach(function (p) {
            if (!p.drawer) return;
            var cls = p.id === pageId ? ' active' : '';
            html += '<a class="drawer-item' + cls + '" href="' + p.path + '"><span class="di-icon">' + p.icon + '</span>' + p.title + '</a>';
        });
        drawer.innerHTML = html;
    }

    // ── Auth Flow ────────────────────────────────────────────────
    // Standardize: loading görünür → auth kontrol → login veya app
    function setupAuth(config) {
        fh.init();
        fh.onAuth({
            onLogin: function (user) {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('loading-screen').style.display = 'flex';
                var bnav = document.getElementById('bnav');
                if (bnav) bnav.style.display = 'flex';
                renderAvatar(user);
                if (config && config.onLogin) config.onLogin(user);
            },
            onLogout: function () {
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
        renderAvatar: renderAvatar,
        toggleDrawer: toggleDrawer,
        toggleDropdown: toggleDropdown,
        injectLogin: injectLogin,
        injectLoading: injectLoading,
        injectBnav: injectBnav,
        injectDrawer: injectDrawer,
        setupAuth: setupAuth,
        showApp: showApp
    };
})();
