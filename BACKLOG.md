# Backlog — Düğün Planlayıcı

## ✅ Tamamlanan

### v0.5 — Kurtarma Mekanizması (10 Nisan 2026)
- `firebase-config.js` + `firestore-helpers.js` ortak modül
- 6 sayfa migration (fh.init/listen/saveDoc)
- Otomatik history/ subcollection versiyonlama (5dk throttle, 30 retention)
- Global error handling (window.onerror → toast)
- Firestore Security Rules: `request.auth != null`

### Önceki fazlar
- Phase A: Sheets sync temizliği
- Phase B: Davetliler iyileştirmeleri (drag-drop, RSVP, arama)
- Phase C: Rose & Navy teması
- Phase D: Dashboard timeline
- Phase E: Görevler agenda redesign
- Phase H: Türkçeleştirme (trLabel)
- Phase I: Bütçe v2
- Phase J: Critical bug fixes (transaction, seeding, dirty check)
- Phase K: MEDIUM fixes (Türkçe nav, searchable dropdown, hasPendingWrites)
- Phase L: CLAUDE.md + backlog + memory yapısı

## 📋 Bekleyen — UX Polish

- [x] showToast kopyalarını fh.toast() ile değiştir (4 dosya, 25 çağrı) ✅
- [x] Mekanlar dead code temizle (VENUE_NAME_MIGRATION kaldırıldı) ✅
- [x] Görevler sayfası compact kart yapısına geçiş ✅
- [x] Timeline: setInterval(60s) → visibilitychange (temiz kod) ✅

## 🗓️ Gelecek Fazlar

### v0.6 — Hosting & Repo Taşıma
- [ ] GitHub repo public → private
- [ ] Firebase Hosting'e geçiş (dugun-planlayici.web.app)
- [ ] Eski GitHub Pages URL'inden yönlendirme
- [ ] Firebase Hosting CLI deploy script

### v0.7 — Soft Delete
- [ ] Item'lara `deletedAt` field pattern'ı
- [ ] "Çöp Kutusu" görünümü (sayfa içi chip)
- [ ] 30 gün sonra otomatik kalıcı silme
- [ ] Sayfalar: davetliler + görevler + bütçe

### v0.8 — Observability
- [ ] Sentry free tier (client-side error tracking)
- [ ] Audit log (kim ne zaman neyi değiştirdi)

### v1.0 — Çok Kullanıcılı Geçiş
- [ ] Veri modeli: `shared/*` → `weddings/{weddingId}/*`
- [ ] Firestore Security Rules (wedding üyeliğine göre)
- [ ] Firebase Blaze plan (scheduled export, PITR)
- [ ] Staging environment
- [ ] Onboarding akışı
- [ ] DEFAULT_TASKS / DEFAULT_VENUES seed datalarını kaldır (hardcoded → onboarding ile dinamik)
