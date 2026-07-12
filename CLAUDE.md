# Düğün Planlayıcı — Proje Kılavuzu

## Bilgi Yönetimi Kuralları

Claude her yeni bilgiyi, yönlendirmeyi veya kararı otomatik olarak doğru dosyaya kaydeder. Kullanıcı dosya adı belirtmek zorunda değildir.

**Nereye ne yazılır:**
- **Bu dosya (CLAUDE.md)**: Proje özeti, teknik yapı, deploy, kritik prensipler. ~120 satır, kısa tut.
- **BACKLOG.md**: Roadmap, gelecek fazlar, bekleyen işler, UX polish listesi. Büyüyebilir.
- **SESSION_LOG.md**: Her session sonunda kronolojik faz özeti eklenir.
- **memory/calisma_prensipleri.md**: Kullanıcı çalışma tercihleri ve geri bildirimleri (tüm feedback tek dosya).
- **memory/user_ibrahim.md**: Kişisel profil (proje-bağımsız).
- **memory/project_mekan_sureci.md**: Mekan seçimi süreci (aktif planlama).

**Kurallar:**
- Yeni dosya oluşturma — mevcut dosyalara ekle.
- Bilgi tekrarı yapma — her bilgi tek yerde yaşar.
- Kullanıcı bir tercih/yönlendirme söylediğinde → `calisma_prensipleri.md`'ye kaydet.
- Kullanıcı yeni iş/özellik istediğinde → `BACKLOG.md`'ye ekle.
- Proje yapısı değiştiğinde → bu dosyayı güncelle.
- Session bittiğinde → `SESSION_LOG.md`'ye faz özeti ekle.

## Proje Nedir

İbrahim + Hilal için düğün planlama web uygulaması. Tek çift (v0.X). Mobil öncelikli. Gerçek zamanlı senkron.

## Canlı & Deploy

- **URL**: https://dugun-planlayici-ff34e.web.app (Firebase Hosting)
- **Repo**: https://github.com/ikoncu/dugun-planlayici (private yapılacak)
- **Deploy = CI (elle DEĞİL)**: main'e push → GitHub Actions (`.github/workflows/deploy.yml`) hosting'i otomatik deploy eder. Canlının kaynağı **main**'dir. Elle `firebase deploy` YAPMA — eski/stale branch'ten deploy canlıyı geri alır.
- **Sadece rules CI dışı**: gerekirse elle `firebase deploy --only firestore:rules --project dugun-planlayici-ff34e`.
- **Lokal**: launch.json (`python3 -m http.server 8080`) + `firestore-helpers.js` `_DEV` mock (localhost auth bypass).
- **Push öncesi onay al** — canlıya almadan kullanıcıya sor.

## Geliştirme Akışı (Git & Paralel Agent)

Paralel çalışma + merge'lerin birbirini ezmemesi için kalıcı kurallar:

1. **Her yeni iş = güncel main'den worktree.** Yeni session/agent başlatırken base **her zaman `main`** + worktree aç. Eski/feature/backup branch'te başlatma (stale-base faciasının kaynağı buydu).
2. **1 agent = 1 dosya/sayfa.** Paralel agent'lar farklı dosyalara dokunsun (sayfa-başına-dosya yapısı buna uygun: gorevler/mekanlar/davetliler/masa-plani ayrı). Aynı dosyayı iki agent düzenlemesin → çakışma olmaz.
3. **Merge öncesi main'i çek.** `git checkout feature/x && git merge main` → conflict'i burada çöz + test et → sonra `main`'e merge. Git 3-yönlü birleştirir, main'in yeni işini sessizce ezmez.
4. **Deploy sadece main→CI.** Hiçbir branch'ten elle deploy yok → canlı hep main = ezme yok.
5. **Kısa branch, sık merge.** Uzun yaşayan branch = büyük conflict.
6. **Silmeden önce bak.** Branch silmeden önce `git log main..<branch>` ile main'de olmayan commit var mı kontrol et; varsa kullanıcıya sor (ör. `backup/pwa-watchdog` = merge edilmemiş PWA+watchdog işi).

## Teknik Yığın

- 5 HTML + `firebase-config.js` + `firestore-helpers.js` + `shared-ui.js`
- Firebase Firestore (Spark/free), Google Auth, Firebase Hosting
- `fh` = veri katmanı: `fh.init()` / `fh.listen()` / `fh.saveDoc()` / `fh.forceVersion()` / `fh.loadHistory()`
- `UI` = görsel katman: `UI.injectLogin()` / `UI.injectBnav()` / `UI.injectDrawer()` / `UI.setupAuth()` / `UI.showApp()`
- Otomatik versiyonlama: her save'de `history/` subcollection'a snapshot (5dk throttle, 30 retention)
- Security Rules: UID allowlist (sadece İbrahim + Hilal erişebilir)

## Dosya Yapısı

| Dosya | Sayfa | Firestore Doc |
|-------|-------|---------------|
| `index.html` | Dashboard (timeline + özetler) | 3 doc dinler (tasks, guests, venues) |
| `gorevler.html` | Görevler (subtask, drag-drop) | `shared/planner_tasks` |
| `davetliler.html` | Davetliler, RSVP, backup, düzenleyiciler | `shared/guests` + `editors/` + `invites/` |
| `mekanlar.html` | Mekanlar, not odaklı | `shared/venues` |
| `masa-plani.html` | Masa düzeni | `shared/tables` + `shared/guests` |
| `shared-ui.js` | Ortak UI (login, drawer, bnav, avatar) | — |
| `firestore-helpers.js` | Veri katmanı (auth, CRUD, versiyonlama) | — |
| `firebase-config.js` | Firebase credentials | — |

## Kritik Prensipler

1. Veri kaybı kabul edilemez
2. Mobile first — önce mobil tasarla
3. Loading ile başla — login ekranı gösterme
4. Sade UI — karmaşıklıktan kaçın
5. Akış önce, kod sonra — non-trivial işlerde önce tasarım onayı
6. Sessiz kırılma olmasın — her hata toast ile gösterilmeli
7. Küçük dokunuşlar — büyük değişiklik yerine kademeli iyileştirme
8. Hilal testi — "Hilal bunu kullanabilir mi?" filtresi

## Versiyon

- **Şu an**: v0.10 (tek seferlik davet linki: linke tıklayıp giren İLK kişi düzenleyici olur, 7 gün geçerli; ana listeyi birlikte düzenler, sadece davetliler sayfası)
- **Sıradaki**: BACKLOG.md'ye bak
- **v1.0**: çok kullanıcılı geçiş (ertelendi)

## Dikkat

- `shared/guests` → gerçek kişiler, seed data koddan kaldırıldı (v0.6), veri sadece Firestore'da
- **Düzenleyiciler (v0.10, tek seferlik davet)**: sahip `invites/{token}` oluşturur (`davetliler.html?davet=<token>`, 7 gün geçerli). Linkle Google ile giren İLK kişi daveti sahiplenir: tek atomik batch'te invite `used:true` + `editors/{email}` kaydı oluşur — rules (`get`/`getAfter`) bu batch'i şart koşar, aynı link ikinci kez KULLANILAMAZ (yarış güvenli). `isGuestEditor()` = `exists(editors/{email})` → SADECE `shared/guests` (+`history/`) okur/yazar. Erişim kesme = modaldan editör silme (anında). Kullanılmış/süresi geçmiş linke tıklayan "süresi dolmuş, yeni link isteyin" ekranı görür. Sahip olmayan kullanıcı tüm sayfalardan davetliler.html'e yönlenir (`shared-ui.js` guard + `UI.isOwnerUser`). Eski v0.9 `shared/editors` e-posta listesi, sahip modalı ilk açtığında otomatik `editors/` kayıtlarına taşınır.
- `copies/{id}` → v0.7 kopya-paylaşım modeli emekli edildi (v0.9): kod ve kurallar kaldırıldı, Firestore'daki eski kopya verisi duruyor (sadece sahip erişir).
- **Hane/grup (v0.8)**: davetli `group` alanı hane adı olarak kullanılır. Ekleme modalında "Aynı haneye kişi ekle" → her birey ayrı `list` kaydı (total 1), ortak `group`. Liste `renderList` içinde `group`'a göre gruplanır (`buildHouseHTML`, açılır/kapanır `collapsedHouses`). Aynı `group` string'ine sahip TÜM kayıtlar tek hane başlığı altında toplanır — şema değişmedi.
- `shared/roadmap` → eski atıl veri, kod kullanmıyor
- `shared/budget_v2` → bütçe sayfası kaldırıldı (v0.6), Firestore doc korunuyor
- **Lokal test & önizleme**: `firestore-helpers.js` içinde `_DEV` mock var — **localhost** VE **Firebase önizleme kanalları** (host'ta `--` var, ör. `...--kanal-hash.web.app`) mock moda girer: auth atlanır, `_mock` (zengin demo veri) ile çalışır, gerçek Firestore'a dokunmaz. Sol altta 🔧 DEV paneli owner↔editör geçişi; düzenleyici listesi `wed-dev-editors` localStorage. **Canlı** (`dugun-planlayici-ff34e.web.app`, `--` yok) mock ASLA aktif olmaz.
- **Önizleme deploy**: `.github/workflows/preview.yml` → `claude/**` branch'ine push veya main'e PR'da geçici (7 gün) önizleme kanalı deploy eder. Link: Actions run "Summary" / PR yorumu. Canlıya dokunmaz. Canlı deploy yalnızca `deploy.yml` (main'e push, `channelId: live`).
- Yeni sayfa eklemek: `shared-ui.js` PAGES dizisine 1 satır + yeni HTML dosyası
