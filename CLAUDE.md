# Düğün Planlayıcı — Proje Kılavuzu

## Bilgi Yönetimi Kuralları

Claude her yeni bilgiyi, yönlendirmeyi veya kararı otomatik olarak doğru dosyaya kaydeder. Kullanıcı dosya adı belirtmek zorunda değildir.

**Nereye ne yazılır:**
- **Bu dosya (CLAUDE.md)**: Proje özeti, teknik yapı, deploy, kritik prensipler. ~120 satır, kısa tut.
- **BACKLOG.md**: Roadmap, gelecek fazlar, bekleyen işler, UX polish listesi. Büyüyebilir.
- **SESSION_LOG.md**: Her session sonunda kronolojik faz özeti eklenir.
- **memory/calisma_prensipleri.md**: Kullanıcı çalışma tercihleri ve geri bildirimleri (tüm feedback tek dosya).
- **memory/user_ibrahim.md**: Kişisel profil (proje-bağımsız).
- **memory/project_mekan_sureci.md**: Mekan seçimi süreci (tamamlandı — MSM Erikçe).

**Kurallar:**
- Yeni dosya oluşturma — mevcut dosyalara ekle.
- Bilgi tekrarı yapma — her bilgi tek yerde yaşar.
- Kullanıcı bir tercih/yönlendirme söylediğinde → `calisma_prensipleri.md`'ye kaydet.
- Kullanıcı yeni iş/özellik istediğinde → `BACKLOG.md`'ye ekle.
- Proje yapısı değiştiğinde → bu dosyayı güncelle.
- Session bittiğinde → `SESSION_LOG.md`'ye faz özeti ekle.

## Proje Nedir

İbrahim + Hilal için düğün planlama web uygulaması. Mobil öncelikli, gerçek zamanlı senkron.
**Düğün: 10 Eylül 2026, MSM Erikçe (kesin).** Nişan (16 Mayıs 2026) tamamlandı.
v0.7 ile veri modeli çok-çiftli (SaaS-hazır) `weddings/{id}` yapısına geçti; UI hâlâ tek çift odaklı.

## Canlı & Deploy

- **URL**: https://dugun-planlayici-ff34e.web.app (Firebase Hosting)
- **Repo**: https://github.com/ikoncu/dugun-planlayici (private yapılacak)
- **Deploy**: `main`'e push → GitHub Actions otomatik deploy (veya `firebase deploy --project dugun-planlayici-ff34e`)
- **Sadece rules**: `firebase deploy --only firestore:rules --project dugun-planlayici-ff34e`
- **Push öncesi onay al** — canlıya almadan (main merge) kullanıcıya sor.

## Teknik Yığın

- 5 HTML + `firebase-config.js` + `firestore-helpers.js` + `shared-ui.js` (build'sız vanilla)
- Firebase Firestore (Spark/free), Google Auth, Firebase Hosting
- `fh` = veri katmanı: `fh.init()` / `fh.resolveWedding()` / `fh.path(name)` / `fh.listen()` / `fh.saveDoc()` / transaction helpers / `fh.forceVersion()` / `fh.loadHistory()`
- `UI` = görsel katman: `UI.injectLogin()` / `UI.injectBnav()` / `UI.injectDrawer()` / `UI.setupAuth()` / `UI.showApp()`
- Tema (v0.7): "Zarif & Romantik" — fildişi + antika altın, Cormorant Garamond serif başlıklar (shared.css)
- Otomatik versiyonlama: her save'de `history/` subcollection'a snapshot (5dk throttle, 30 retention)
- Security Rules: `weddings/{wid}.memberUids` üyelik modeli + legacy `shared/*` allowlist + login'siz token bazlı `rsvp/`

## Veri Modeli (v0.7)

- `weddings/{wid}`: coupleNames, weddingDate, venue, memberUids[]
- `weddings/{wid}/data/guests|tasks|tables`: liste dokümanları (`{list:[...]}`)
- `weddings/{wid}/data/nisan_arsiv|nisan_gorev_arsiv`: nişan dönemi arşivi
- `weddings/{wid}/rsvp/{token}`: davetli RSVP yanıtları (login'siz, tahmin edilemez token)
- Login → `UI.setupAuth` → `fh.resolveWedding()`; düğün yoksa kurulum/migration ekranı

## Dosya Yapısı

| Dosya | Sayfa | Firestore |
|-------|-------|-----------|
| `index.html` | Dashboard (geri sayım + RSVP + görev özeti) | tasks, guests |
| `gorevler.html` | Görevler (subtask, drag-drop, 🎤 sesli ekleme) | `data/tasks` |
| `davetliler.html` | Davetliler, RSVP link/WhatsApp paylaşımı, yedek | `data/guests` + `rsvp/` |
| `masa-plani.html` | Masa düzeni | `data/tables` + `data/guests` |
| `rsvp.html` | Davetliye açık LCV sayfası (login'siz) | `rsvp/{token}` |
| `shared-ui.js` | Ortak UI (login, drawer, bnav, setup ekranı) | — |
| `firestore-helpers.js` | Veri katmanı (auth, wedding bağlamı, CRUD, versiyonlama) | — |
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

- **Şu an**: v0.7 (düğün modu: yeni tema, weddings/ modeli, RSVP linki, sesli görev, mekanlar kaldırıldı)
- **Sıradaki**: BACKLOG.md'ye bak (AI arama ajanı, masa krokisi)
- **v1.0**: herkese açık SaaS (onboarding + partner davet akışı)

## Dikkat

- **Migration**: İlk girişte "Düğün alanınızı oluşturun" ekranı çıkar; nişan davetlileri RSVP sıfırlanarak taşınır, orijinali `data/nisan_arsiv`'de + `shared/*` dokunulmadan durur
- `shared/*` → legacy nişan verisi, kod artık yazmıyor; rules'ta allowlist ile korunuyor
- Davetli drag-drop kaldırıldı (v0.7) — sıralama yalnızca sort menüsünden (asenkron çakışma şikayeti)
- RSVP yanıtları davetliler sayfası açıkken otomatik listeye işlenir (idempotent, respondedAt bazlı)
- Localhost'ta Security Rules nedeniyle veri gelmez (gerçek Google auth gerekir)
- Yeni sayfa eklemek: `shared-ui.js` PAGES dizisine 1 satır + yeni HTML dosyası
