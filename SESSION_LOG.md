# Session Log — Düğün Planlayıcı

Son güncelleme: 2026-04-09

## Tamamlanan Fazlar

### Phase A — Sheets senkronizasyonu temizliği
- Otomatik çift yönlü merge denendi, sonra tamamen kaldırıldı ("veri kaybı kabul edilemez")
- "Sheets'ten Çek" butonu ve tüm sync fonksiyonları kaldırıldı
- Excel upload kaldırıldı, sadece export kaldı

### Phase B — Davetliler iyileştirmeleri
- Sıralama: A-Z, en yeni, RSVP durumu (groupSort priority fix)
- Uzun-basma drag & drop + otomatik scroll (viewport kenarına yaklaşınca)
- Filtre/arama aktifken drag kapalı (canDrag guard)
- Arama: isim + telefon + grup + masa + not
- Dashboard: "Toplam Kişi (X) / Y davet" (g.total ?? 1)
- RSVP değişiminde in-place DOM update + skipNextRender (kart kaybolma bug'ı çözüldü)

### Phase C — Modern Rose & Navy teması
- 6 sayfaya #d64f6d + navy paleti uygulandı

### Phase D — Dashboard timeline
- Bugün → Nişan (16 Mayıs) → Düğün (Eylül~) zaman çizgisi
- Tıklanabilir tarihler + validasyon (geçmiş kontrolü, nişan < düğün)
- Etiketler çizginin altında hizalı

### Phase E — Görevler yeniden tasarım
- 43 dağınık kart → 6 gruplu ana görev (subtask'lı agenda stili)
- parseLocalDate() UTC bug fix
- Subtask done state ID ile korunuyor (metin düzenlenince kaybolmuyor)
- Kategori filtreleri ve migration kodu kaldırıldı
- Long-press drag-drop + auto-scroll

### Phase H — Türkçeleştirme
- trLabel() helper: ASCII data → Türkçe display (ş, ğ, ı, ü, ç, ö, İ)
- Tüm UI string'leri Türkçe karakterli

### Phase I — Bütçe sıfırdan yazıldı
- Yeni Firestore doc: `shared/budget_v2` (eski `budget` dokunulmadı)
- Model: {totalBudget, items: [{id, name, cat, status, estimated, paid, note}]}
- Ayrı değerler: estimated, paid, remaining, pending
- ₺ currency (tr-TR locale), kategori ikonları, status (planlı/kapora/ödendi)
- Bütçe aşımı uyarısı

### Phase J — Critical + HIGH bug fix'leri (commit 8629839)
- **masa-plani.html**: Firestore transaction ile cross-page veri kaybı çözüldü
- **mekanlar.html**: Default seeding sadece `!snap.exists` durumunda
- **davetliler.html**: Modal dirty check (tryCloseModal)
- Tüm sayfalarda lokal auth bypass (`localhost`)

### Phase K — MEDIUM bug fix'leri + UX polish (commit fef2d6b + 6283556)
- **index.html**: "gorev" → "görev" typo fix, duplicate "Mekanları Gör" kaldırıldı
- **Tüm sayfalar**: Nav/drawer ASCII → Türkçe (Görevler, Bütçe, Diğer, Giriş, Çıkış, Düğün Planlayıcı)
- **mekanlar.html**: ASCII seed → Türkçe migration (Şelale, Köşk, Düğün, Erikçe, Açık Hava) + inline edit save feedback toast + not preview (ilk 3 satır kart üzerinde)
- **masa-plani.html**: Native `<select>` → custom searchable guest dropdown (62 misafir filtre ile arama)
- **Tüm sayfalar**: `skipNextRender` boolean → `snap.metadata.hasPendingWrites` (multi-device race condition fix)
- **Hotfix**: gorevler.html'de snapshot callback param `doc` ↔ `snap` uyumsuzluğu düzeltildi

### Phase L — Proje altyapısı + planlama
- **CLAUDE.md** oluşturuldu: proje kılavuzu + backlog (her session otomatik yüklenir)
- **Kurtarma mekanizması tasarımı**: firestore-helpers.js API tasarımı yapıldı (kod yazılmadı)
  - Subcollection per doc versiyonlama kararı
  - 30 versiyon retention, 5dk throttle
  - Dev-side only (kullanıcı UI yok)
  - 6 açık tasarım sorusu sonraki session'a bırakıldı
- **Memory dosyaları güncellendi**: feedback_plan_first.md, project_versiyon_stratejisi.md eklendi
- **SESSION_LOG.md güncellendi**

### Phase M — v0.5 İmplementasyon + Altyapı Temizliği (10 Nisan 2026)
- **firestore-helpers.js** oluşturuldu: fh.init/listen/saveDoc/toast/adminRestore
- **firebase-config.js** oluşturuldu: tek config kaynağı
- **6 sayfa migration**: tüm sayfalar helper'a geçti (index, davetliler, gorevler, mekanlar, butce, masa-plani)
- **Security Rules**: `request.auth != null` deploy edildi (Firebase CLI ile). 1 Mayıs expire sorunu çözüldü.
- **Mekanlar UX**: compact kart, not preview (5 satır fade-out), expand → tam not, scroll fix, form sadeleştirme (isim+Instagram+not)
- **Masa planı**: searchable guest dropdown (62 misafir filtre)
- **Türkçeleştirme**: tüm nav/drawer/login ASCII → Türkçe, mekan isimleri migration
- **E2E test**: 6 sayfa, 17 senaryo, hepsi geçti
- **Bilgi yönetimi konsolidasyonu**:
  - 12 dosya → 6 dosya (CLAUDE.md + BACKLOG.md + SESSION_LOG.md + 3 memory)
  - 5 ayrı feedback dosyası → tek calisma_prensipleri.md
  - Eski/outdated memory dosyaları kaldırıldı
  - CLAUDE.md'ye otomatik bilgi yönetimi kuralları eklendi

- **Global CLAUDE.md** oluşturuldu (`~/.claude/CLAUDE.md`): tüm projelerde geçerli 9 kural
  - Mevcut `ibrahim-koncu.md` ve `howtoplanskills.md` korundu, referans verildi

### Phase N — v0.6: Hosting + Altyapı + Temizlik (11 Nisan 2026)
- **Tam proje taraması**: 4500+ satır, 8 dosya satır satır incelendi
- **Bug fix'ler**: Dashboard progress subtask-aware, masa-plani div nesting, bütçe b.list→b.items
- **Bütçe sayfası kaldırıldı**: butce.html silindi, dashboard bölümü + drawer linki kaldırıldı
- **Masa planı bnav'a eklendi**: 5 linkli bottom nav (Ana Sayfa, Görevler, Mekanlar, Davetliler, Masa)
- **shared-ui.js oluşturuldu**: login, loading, drawer, bnav, avatar, auth flow tek dosyada
  - 5 HTML dosyasından ~1000 satır duplicate kod kaldırıldı
  - Yeni sayfa = PAGES dizisine 1 satır
  - Standardizasyon: .open class, flex bnav, Structure C header
- **UID allowlist**: Firestore rules'a İbrahim + Hilal UID'leri eklendi
- **Firebase Hosting'e geçiş**: firebase.json güncellendi, GitHub Pages'den geçiş
- **Seed data kaldırıldı**: DEFAULT_GUESTS (37 kişi + telefon), DEFAULT_TASKS, DEFAULT_VENUES koddan çıkarıldı
- **Backup basitleştirildi**: shared/guests_backup → fh.history entegrasyonu (forceVersion + loadHistory)
- **Ölü kod temizliği**: dead toast CSS/HTML, saveGuests(), esc() kopyaları, renderAvatar kopyaları
- **Migration kaldırıldı**: applyMigration_20260406() (zaten çalışmış)
- **Kararlar**: İbrahim ile 4 turda AskUserQuestion ile tüm kararlar alındı

## v0.7 — Paylaşılan Davetli Listeleri (2026-07-03)
- **Evrensel paylaşım sistemi**: Sahip (İbrahim/Hilal) davetli listesinin izole kopyasını oluşturur (`copies/{id}`), e-postayla düzenleyici ekler. Düzenleyici sadece kendi kopyasını görür/düzenler; ana liste değişmez. Kod/kural içine e-posta gömülmez — `duzenleyenler` array'inden gelir (`isEditorOf` rule).
- **"Bana aktar" (vurgulu birleştirme)**: Sahip, kopyadaki yeni (yeşil) / değişen (turuncu) kişileri görüp tek tıkla ana listesine ekler/günceller. Dedup guard'ı var.
- **Rol yönlendirme**: sahip→`shared/guests`, düzenleyici→`copies/{id}`, yetkisiz→"Erişim yok". Editör modunda nav/logo/Paylaşımlar gizli, "paylaşılan liste" şeridi.
- **Taraf avatarları**: metin etiketleri kaldırıldı → gelin (beyaz daire/siyah gelinlik SVG) · damat (koyu daire/beyaz smokin SVG).
- **DEV mock genişletildi**: owner↔editör kimlik switcher + kopya localStorage persist (lokal paylaşım testi için).
- **Süreç dersi**: İş yanlışlıkla `backup/pwa-watchdog` (main'den 13 commit geride) üzerinde yapıldı + manuel deploy canlıyı regrese etti. Düzeltme: özellik main tabanına temiz port edildi (sadece 3 dosya), kapsamlı lokal test → main'e merge → CI hosting deploy. Global CLAUDE.md'ye "Git & Deploy Disiplini" kuralları eklendi.

## v0.8 — Hane (grup) olarak davetli ekleme (2026-07-03)
- **Sürtünmesiz hane akışı**: `+` ile açılan modal aynen kalır (tek kişi ekleyen fark etmez). Ad Soyad altında "👨‍👩‍👧 Aynı haneye kişi ekle" butonu; basınca **Hane adı** 1. kişinin soyadından otomatik dolar ("Yılmaz Ailesi"), altına kişiler tek tek isimle eklenir (her satırda yetişkin/çocuk toggle). Taraf + RSVP hane geneli tek ayar.
- **Veri modeli değişmedi**: her birey ayrı `list` kaydı, ortak `group` (hane adı) ile etiketlenir — mevcut `group` alanı kullanıldı, şema değişmedi. Excel export / paylaşım-diff / drag-drop bozulmadı.
- **Liste gruplu görünüm**: aynı `group`'a sahip kişiler açılır/kapanır bir **hane başlığı** altında toplanır (kişi + katılan sayısı). Başlıktaki **"+"** ile aynı haneye sonradan kişi eklenir (modal hane adı + taraf ön-dolu açılır). Grubu olmayan davetliler eskisi gibi tek tek.
- **Test**: Playwright (localhost DEV mock) ile uçtan uca doğrulandı — otomatik hane adı, çocuk toggle, gruplu render, aç/kapa, başlıktan ekleme, grupsuz tek kişi akışı; page error yok.

## v0.8.1 — Otomatik önizleme deploy + zengin mock (2026-07-03)
- **Preview channel deploy**: `.github/workflows/preview.yml` — `claude/**` push / main'e PR'da geçici (7 gün) Firebase önizleme kanalına deploy, link Actions Summary + PR yorumu. Canlıya (deploy.yml, channelId: live) dokunmaz. Kanal adı ref'ten sanitize edilir (`/`→`-`).
- **Preview = demo/mock modu**: `_DEV` artık localhost + host'unda `--` olan önizleme kanallarını da kapsar. Böylece önizleme linki giriş gerektirmez, zengin mock veriyle çalışır, gerçek Firestore'a dokunmaz. Canlı host (`--` yok) etkilenmez — hostname tespiti birim testiyle doğrulandı.
- **Zengin mock veri**: 5 → 21 kayıt (22 kişi). Çok haneli aileler (Yılmaz/Demir/Şahin/Kaya Ailesi + İş Arkadaşları) yeni gruplu görünümü hemen sergiler; grupsuz tekiller + eski usul çok-kişili tek kart (Akrabalar) korunur. Görev/mekan/masa verisi de genişletildi.
- **DEV-safe fix**: `index.html` `loadDates/saveDates` artık `fh.db` null iken (mock mod) patlamıyor — 5 sayfa da mock modda page-error'suz açılıyor (Playwright ile doğrulandı).

## Son Durum
- Canlı: `dugun-planlayici-ff34e.web.app` (Firebase Hosting)
- Versiyon: v0.8
- 5 sayfa: index, gorevler, davetliler, mekanlar, masa-plani
- 3 JS modülü: firebase-config.js, firestore-helpers.js, shared-ui.js
- Detaylar: CLAUDE.md (proje), BACKLOG.md (roadmap)
