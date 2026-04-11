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
- **Deploy**: `firebase deploy --project dugun-planlayici-ff34e`
- **Lokal**: `ruby -run -e httpd . -p 8080` (launch.json)
- **Sadece rules**: `firebase deploy --only firestore:rules --project dugun-planlayici-ff34e`
- **Push öncesi onay al** — canlıya almadan kullanıcıya sor.

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
| `davetliler.html` | Davetliler, RSVP, backup | `shared/guests` |
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

- **Şu an**: v0.6 (hosting geçişi + shared-ui + temizlik)
- **Sıradaki**: BACKLOG.md'ye bak
- **v1.0**: çok kullanıcılı geçiş (ertelendi)

## Dikkat

- `shared/guests` → gerçek kişiler, seed data koddan kaldırıldı (v0.6), veri sadece Firestore'da
- `shared/roadmap` → eski atıl veri, kod kullanmıyor
- `shared/budget_v2` → bütçe sayfası kaldırıldı (v0.6), Firestore doc korunuyor
- Localhost'ta Security Rules nedeniyle veri gelmez (gerçek Google auth gerekir)
- Yeni sayfa eklemek: `shared-ui.js` PAGES dizisine 1 satır + yeni HTML dosyası
