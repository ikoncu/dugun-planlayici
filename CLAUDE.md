# Düğün Planlayıcı — Proje Kılavuzu

Bu dosya her yeni Claude Code session'ında otomatik yüklenir. Projenin sabit bilgilerini, kurallarını ve gelecek planını içerir.

## Proje Nedir

İbrahim + Hilal için düğün planlama web uygulaması. Tek çift kullanıyor (v0.X). Mobil öncelikli. Gerçek zamanlı senkron (iki kişi aynı anda kullanabilir).

## Canlı

- **URL**: https://ikoncu.github.io/dugun-planlayici/
- **Repo**: https://github.com/ikoncu/dugun-planlayici (public)
- **Deploy**: `git push origin main` → GitHub Pages otomatik yayınlar (1-2 dk)

## Teknik Yığın

- **Frontend**: 6 HTML dosyası, embedded CSS + JS, framework yok, build step yok
- **Backend**: Firebase Firestore (Spark / free plan)
- **Auth**: Firebase Google Sign-In
- **Hosting**: GitHub Pages
- **Lokal preview**: `ruby -run -e httpd . -p 8080` (launch.json'da tanımlı)
- **Lokal auth bypass**: Her sayfada localhost kontrolü var, login atlar

## Dosya Yapısı

| Dosya | Sayfa | Firestore Doc |
|-------|-------|---------------|
| `index.html` | Dashboard (timeline + özetler) | Diğer doc'ları okur |
| `gorevler.html` | Görev listesi (agenda stili, subtask'lı) | `shared/roadmap` |
| `davetliler.html` | 62 davetli, RSVP, gruplama | `shared/guests` |
| `mekanlar.html` | 7 Gaziantep mekanı, favoriler | `shared/venues` |
| `butce.html` | Bütçe kalemleri, ödeme durumu | `shared/budget_v2` |
| `masa-plani.html` | Masa düzeni, kişi atama | `shared/tables` |

Diğer Firestore doc'lar: `users/{uid}` (profiller), `notes` collection (notlar), `shared/planner_tasks` (eski, kullanılmıyor)

## Kritik Prensipler

1. **Veri kaybı kabul edilemez** — her değişiklik bu filtreden geçer
2. **Mobile first** — önce mobil tasarla, masaüstü ikincil
3. **Loading ile başla** — auth ekranını tekrar gösterme
4. **Tek dosya / sade UI** — karmaşıklıktan kaçın
5. **ASCII data / Türkçe display** — Firestore'da ASCII, UI'da trLabel() ile Türkçe
6. **Akış önce, kod sonra** — non-trivial işlerde önce tasarım sun, onay al, sonra kodla
7. **Sessiz kırılma olmasın** — her hata kullanıcıya toast ile gösterilmeli

## Versiyon Stratejisi

- **Şu an**: v0.X — tek çift (İbrahim + Hilal), `shared/*` veri modeli, free tier
- **v1.0**: çok kiracılı (`weddings/{id}/*`), Firestore Security Rules, Blaze plan, staging env

## Dokunma / Dikkat

- `shared/guests` → 62 gerçek kişi. Seed data (`DEFAULT_GUESTS`) varsa dokunma, Firestore'daki canlı verinin üstüne yazma.
- `mekanlar.html` → Seed data sadece `!snap.exists` durumunda çalışır, mevcut veriyi ezmez.
- `davetliler.html` → En çok iterasyon gören dosya. Drag-drop, skipNextRender (artık hasPendingWrites), modal dirty check var.

---

## Backlog — Gelecek Fazlar

### v0.5 — Kurtarma Mekanizması (tasarım onaylandı, kod yazılmadı)

**Amaç**: Sessiz felaket sigortası. Kullanıcıya görünmez, dev-side backup.

**Kararlar (kesinleşen)**:
- Versiyon depolama: subcollection per doc (`shared/{doc}/history/{versionId}`)
- Retention: son 30 versiyon
- Throttle: min 5 dk aralıkla versiyon
- Kullanıcı UI'ı yok — dev Firebase Console'dan restore eder
- Hosting: GitHub Pages'de kalıyor (Firebase Hosting v0.6'ya ertelendi)

**Kararlar (bekleyen — tasarım tartışmasında)**:
- [ ] Throttle penceresi: 5 dk mı, 2 dk mı?
- [ ] authorName kaynağı: currentUser.displayName mi, manual override map mi?
- [ ] Test sayfası (test.html) oluşturulsun mu?
- [ ] FIREBASE_CONFIG: ayrı dosya mı, helper içinde mi, her sayfadan parametre mi?
- [ ] Pilot sayfa: davetliler mi, mekanlar mı?
- [ ] İsimlendirme: `fh` mı, `WedHelpers` mı, başka mı?

**Teknik tasarım**: Bu session'da (9 Nisan 2025) detaylı API tasarımı yapıldı:
- `fh.init()`, `fh.onAuth()`, `fh.listen()`, `fh.saveDoc()`, `fh.loadHistory()`, `fh.adminRestore()`, `fh.toast()`, `fh.setupErrorHandling()`
- Tam tasarım belgesi conversation history'de mevcut.

**İmplementasyon planı**:
1. `firestore-helpers.js` oluştur + izole test (test.html)
2. Pilot sayfada uygula, davranış doğrula
3. Diğer sayfalara yay
4. Eski kopya kodları temizle

### v0.6 — Hosting & Repo Taşıma

- [ ] GitHub repo public → private
- [ ] Firebase Hosting'e geçiş (dugun-planlayici.web.app)
- [ ] Eski GitHub Pages URL'inden yönlendirme (redirect HTML)
- [ ] Firebase Hosting CLI setup + deploy script

### v0.7 — Soft Delete

- [ ] Item'lara `deletedAt` field pattern'ı (silinen kayıp olmaz, filtrelenir)
- [ ] "Çöp Kutusu" görünümü (çok basit, sayfa içi chip)
- [ ] 30 gün sonra otomatik kalıcı silme (client-side purge)
- [ ] Hangi sayfalar: davetliler + görevler + bütçe (öncelik sırasıyla)

### v0.8 — Observability

- [ ] Sentry free tier entegrasyonu (client-side error tracking)
- [ ] Audit log (kim ne zaman neyi değiştirdi — `audit/{docName}/events`)

### v1.0 — Çok Kullanıcılı Geçiş

- [ ] Veri modeli: `shared/*` → `weddings/{weddingId}/*`
- [ ] Firestore Security Rules (wedding üyeliğine göre)
- [ ] Firebase Blaze plan (scheduled export, PITR)
- [ ] Staging environment (ikinci Firebase projesi)
- [ ] Onboarding akışı (yeni çift nasıl kaydolur)
- [ ] Sentry + alerting
