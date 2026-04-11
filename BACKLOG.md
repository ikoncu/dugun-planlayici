# Backlog — Düğün Planlayıcı

## Tamamlanan

### v0.6 — Hosting + Temizlik + Altyapı (11 Nisan 2026)
- Firebase Hosting'e geçiş (GitHub Pages'den)
- Repo private yapılacak (İbrahim yapacak)
- UID allowlist: sadece İbrahim + Hilal erişebilir
- shared-ui.js: ortak bileşenler (login, drawer, bnav, avatar) tek dosyada
- Bütçe sayfası kaldırıldı (butce.html silindi, dashboard bölümü kaldırıldı)
- Masa planı bnav'a 5. link olarak eklendi
- Ölü kod temizliği (dead toast, saveGuests, duplicate esc/renderAvatar/toggleDrawer)
- Backup sistemi fh.history'ye entegre (shared/guests_backup yerine history/ subcollection)
- Seed data koddan çıkarıldı (DEFAULT_GUESTS, DEFAULT_TASKS, DEFAULT_VENUES)
- Dashboard progress subtask-aware fix
- masa-plani div nesting fix

### v0.5 — Kurtarma Mekanizması (10 Nisan 2026)
- `firebase-config.js` + `firestore-helpers.js` ortak modül
- 6 sayfa migration (fh.init/listen/saveDoc)
- Otomatik history/ subcollection versiyonlama (5dk throttle, 30 retention)
- Global error handling (window.onerror → toast)
- Firestore Security Rules: `request.auth != null`

### Önceki fazlar
- Phase A-E: Sheets sync temizliği, davetli iyileştirmeleri, tema, timeline, görevler redesign
- Phase H-K: Türkçeleştirme, bütçe v2, critical fixes, UX polish
- Phase L-M: CLAUDE.md altyapı, bilgi konsolidasyonu

## Bekleyen — UX Polish

- [ ] Mekan kartlarında note textarea otomatik büyüme (yazdıkça)
- [ ] Görevler drag-drop: long-press 400ms → visual feedback ekle (kullanıcı "tıkladım" sanmasın)

## Gelecek Fazlar

### v0.7 — Soft Delete
- [ ] Item'lara `deletedAt` field pattern'ı
- [ ] "Çöp Kutusu" görünümü (sayfa içi chip)
- [ ] 30 gün sonra otomatik kalıcı silme
- [ ] Sayfalar: davetliler + görevler

### v0.8 — Observability
- [ ] Sentry free tier (client-side error tracking)
- [ ] Audit log (kim ne zaman neyi değiştirdi)

### v1.0 — Çok Kullanıcılı Geçiş
- [ ] Veri modeli: `shared/*` → `weddings/{weddingId}/*`
- [ ] Firestore Security Rules: UID allowlist → wedding membership modeline geçiş
- [ ] Firebase Blaze plan (scheduled export, PITR)
- [ ] Staging environment
- [ ] Onboarding akışı (seed data dinamik olarak oluşturulacak)
