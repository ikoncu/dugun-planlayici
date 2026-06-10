# Session Log — Düğün Planlayıcı

Son güncelleme: 2026-06-10

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

### Phase O — v0.7: Düğün Modu Redesign + SaaS Temeli (10 Haziran 2026)
- **Bağlam**: Nişan bitti (16 Mayıs), düğün kesinleşti (10 Eylül 2026, MSM Erikçe). Kullanıcı: tasarım eski, liste yönetimi zor (drag-drop asenkron karışıklığı), mekan işi bitti, RSVP için AI fikri var, ileride SaaS olarak yayma niyeti.
- **Kararlar (AskUserQuestion ile)**: Hibrit kapsam (SaaS temelli veri modeli + düğün öncelikli UI), vanilla'da kal + modernize, önce link bazlı RSVP (AI arama sonra), nişan listesi RSVP sıfırlanarak taşınsın, zarif & romantik tema.
- **Tema**: shared.css yeniden yazıldı — fildişi/antika altın palet, Cormorant Garamond serif, açık header + blur, eski Rose & Navy gitti. Var isimleri korundu → sayfalar otomatik uyum.
- **Veri modeli**: `weddings/{wid}` (memberUids) + `data/guests|tasks|tables`; fh'a resolveWedding/path/setupWedding eklendi; _docRef ile derin path desteği.
- **Migration**: Login'de düğün yoksa kurulum ekranı → nişan davetlileri RSVP/davetiye/masa sıfırlanarak taşınır; orijinal liste data/nisan_arsiv'e, açık görevler data/tasks'a, tam görev listesi data/nisan_gorev_arsiv'e. shared/* dokunulmadan kalır.
- **RSVP sistemi**: rsvp.html (login'siz davetiye sayfası, token bazlı), davetlilerde "Davet Linki" + "WhatsApp" butonları, yanıtlar idempotent şekilde listeye işlenir; rules'ta sadece yanıt alanları güncellenebilir (validasyonlu).
- **Davetliler**: drag-drop tamamen kaldırıldı (şikayet kaynağı), manuel sıralama gitti, Yedekler butonu eklendi, "✓ yanıtladı" rozeti + davetli notu gösterimi.
- **Görevler**: 🎤 sesli görev ekleme (Web Speech API tr-TR, modal onaylı).
- **index.html**: Yeniden yazıldı — geri sayım hero'su (çift adı, tarih, mekan, kalan gün), RSVP özeti, ilerleme, yaklaşan görevler. Nişan timeline + mekan kartı kaldırıldı.
- **mekanlar.html silindi**, bnav 4 linke indi (Ana Sayfa, Davetliler, Görevler, Masa).
- **Rules**: üyelik modeli + legacy allowlist + public rsvp token kuralları.
- **Not**: Deploy yapılmadı — `claude/wedding-app-redesign-6lf3ie` branch'inde; canlıya almak için main'e merge gerekli (rules deploy'u unutma!).

## Son Durum
- Canlı: `dugun-planlayici-ff34e.web.app` (Firebase Hosting) — henüz v0.6; v0.7 branch'te
- Versiyon: v0.7 (branch: claude/wedding-app-redesign-6lf3ie)
- 5 sayfa: index, davetliler, gorevler, masa-plani, rsvp (public)
- 3 JS modülü: firebase-config.js, firestore-helpers.js, shared-ui.js
- Detaylar: CLAUDE.md (proje), BACKLOG.md (roadmap)
