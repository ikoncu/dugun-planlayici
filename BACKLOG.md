# Backlog — Düğün Planlayıcı

## Tamamlanan

### v0.7 — Düğün Modu: Redesign + SaaS Temeli (10 Haziran 2026)
- "Zarif & Romantik" tema: fildişi + antika altın, Cormorant Garamond serif (shared.css yeniden yazıldı)
- Veri modeli `shared/*` → `weddings/{wid}/data/*` (SaaS-hazır üyelik modeli)
- Security Rules: memberUids üyelik + legacy allowlist + login'siz token bazlı rsvp/
- Nişan→düğün migration ekranı (RSVP sıfırlanır, nişan arşivi korunur, veri kaybı yok)
- rsvp.html: davetliye açık LCV sayfası (token linki, kişi sayısı, not)
- Davetliler: kişiye özel RSVP linki + WhatsApp paylaşımı, yanıtlar listeye otomatik işlenir
- Davetliler drag-drop kaldırıldı (asenkron çakışma şikayeti) — sıralama sort menüsünden
- Görevler: 🎤 sesli görev ekleme (Web Speech API, tr-TR)
- index.html: düğün geri sayımı hero'su (10 Eylül 2026 · MSM Erikçe), nişan timeline kaldırıldı
- mekanlar.html kaldırıldı (mekan kesinleşti), Yedekler butonu davetlilere eklendi

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

- [ ] Görevler drag-drop: long-press 400ms → visual feedback ekle (kullanıcı "tıkladım" sanmasın)
- [ ] Davetliler: toplu RSVP linki gönderimi (tek tek yerine "hepsine gönder" akışı)
- [ ] RSVP yanıt bildirimi (davetli yanıtlayınca çifte görünür bildirim — şimdilik toast)

## Gelecek Fazlar

### v0.8 — Düğün Operasyonu
- [ ] Masa planı: MSM Erikçe krokisine uygun görsel yerleşim (grid/harita görünümü)
- [ ] RSVP almayan davetlilere hatırlatma akışı (WhatsApp tekrar gönder)
- [ ] Nişan arşivi görüntüleme ekranı (data/nisan_arsiv okuma)

### v0.9 — AI RSVP Arama Ajanı (değerlendirilecek)
- [ ] Yanıt vermeyen davetlileri AI'ın telefonla arayıp RSVP alması
- [ ] Gereksinimler: telefon altyapısı (Twilio/Vapi vb.), Türkçe TTS/STT, Firebase Blaze, maliyet analizi
- [ ] Karar: önce link bazlı RSVP denenir; dönüş oranı düşükse bu faz devreye girer

### v0.95 — Soft Delete + Observability
- [ ] Item'lara `deletedAt` field pattern'ı + "Çöp Kutusu" görünümü (davetliler + görevler)
- [ ] Sentry free tier (client-side error tracking)
- [ ] Audit log (kim ne zaman neyi değiştirdi)

### v1.0 — Herkese Açık SaaS
- [x] Veri modeli: `shared/*` → `weddings/{weddingId}/*` (v0.7'de yapıldı)
- [x] Security Rules: UID allowlist → wedding membership (v0.7'de yapıldı)
- [ ] Onboarding akışı: yeni çift kaydı (düğün adı/tarih/mekan formu)
- [ ] Partner davet akışı (eşini e-posta/link ile düğüne üye ekleme — şu an memberUids elle)
- [ ] Landing page + çok dillilik kararı
- [ ] Firebase Blaze plan (scheduled export, PITR), staging environment
- [ ] Kota/maliyet koruması (rate limit, App Check)
