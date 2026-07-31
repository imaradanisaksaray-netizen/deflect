# DEFLECT — Neon Reflex Arcade

Tarayıcıda çalışan, bağımlılığı olmayan hyper-casual refleks oyunu. YouTube Playables'ın
teknik kurallarına uygun yazıldı: saf HTML5, tek klasör, her ekran oranında oynanabilir,
26 KB paket boyutu.

> Kod ve oyun içi metinler İngilizce (hedef kitle küresel). Dokümantasyon Türkçe.

## Oyun

Merkezde bir çekirdek (core), etrafında döndürdüğün bir kalkan yayı var.

| Şekil | Renk | Ne yapmalı |
|-------|------|------------|
| Daire | Cyan | **Blokla** — +10 puan, combo artar |
| Elmas | Altın | **Blokla** — +50 puan, daha hızlı gelir |
| 3 uçlu diken | Kırmızı | **Dokunma** — çekirdeğe geçmesine izin ver |

- 3 can. Cyan/altın merminin çekirdeğe ulaşması veya kırmızı dikene dokunmak 1 can götürür.
- 4 ardışık blok = çarpan +1 (maksimum x8). Hasar aldığında combo sıfırlanır.
- Zorluk 165 saniye boyunca artar: mermiler hızlanır, sıklaşır, kırmızı dikenler 14. saniyede
  devreye girer.
- 165. saniyede **OVERDRIVE** başlar: hız her 200 saniyede bir ikiye katlanır ve tavanı yoktur.
  Spawn aralığı hızla orantılı kısalır, yani ekrandaki mermi sayısı sabit kalır — sadece tepki
  penceresi daralır. Bu, hiçbir turun sonsuza kadar sürememesini garanti eder.

Kontroller: fare hareketi / dokunup sürükleme / ok tuşları / A-D. `P` veya `Esc` duraklat,
`M` sesi kapat, `Space` başlat.

## Çalıştırma

ES modules `file://` üzerinden yüklenmez, bu yüzden bir sunucu gerekir:

```bash
node tools/serve.mjs
```

Sonra `http://127.0.0.1:5173` adresini aç. Port değiştirmek için `PORT=8080 node tools/serve.mjs`.

## Test

```bash
node --test tests/logic.test.mjs
```

Render dışındaki her şey (çarpışma kuralları, zorluk eğrisi, spawn adaleti, açı matematiği)
DOM'suz test edilebilir. 14 test var; en önemlisi spawner'ın **ulaşılamaz mermi çifti**
üretmediğini doğrulayan test — aynı anda gelen iki merminin arası kalkanın dönemeyeceği
kadar açık olamaz.

## Yayın

Adım adım rehber: [docs/publishing.md](docs/publishing.md) — itch.io yükleme ayarları,
GitHub Pages kurulumu ve Playables başvurusu.

`main` dalına her push, testler geçtiği sürece GitHub Pages'i otomatik günceller
(`.github/workflows/deploy-pages.yml`).

## Playables paketi

```bash
node tools/build-zip.mjs
```

`dist/deflect-playables.zip` üretir — `index.html` arşiv kökünde, geliştirici portalının
beklediği yapıda. Bağımlılıksız ZIP yazıcısı `node:zlib` üzerine kurulu, çıktı deterministik.

## Dosya yapısı

```
game/
  index.html            Tek sayfa, dış kaynak yok
  styles.css            Sadece sayfa kabuğu (scroll/zoom/tap engelleme)
  src/
    main.js             Giriş noktası: canvas, resize, ana döngü
    config.js           Bütün ayarlanabilir sayılar
    viewport.js         Polar -> ekran dönüşümü, DPR ölçekleme
    input.js            Pointer + klavye (son kullanılan cihaz kazanır)
    audio.js            WebAudio ile prosedürel ses (dosya yok)
    storage.js          High score (try/catch ile sarmalı)
    math.js             Açı/interpolasyon yardımcıları
    state/game.js       Durum makinesi ve kurallar
    entities/           shield, projectiles, particles
    systems/            spawner, collision, difficulty
    render/             renderer, background, entities, effects, hud, neon
tools/
  serve.mjs             Bağımlılıksız statik sunucu
  build-zip.mjs         Playables ZIP paketleyici
tests/
  logic.test.mjs        node:test ile mantık testleri
```

## Teknik kararlar

**Neden vanilla JS + Canvas, Unity değil?** Unity WebGL build'i 5-15 MB'tan başlar ve
Playables'ın hızlı açılış kriterine takılır. Bu proje sıkıştırılmış 26 KB ve ilk kareyi
anında çizer.

**Neden polar koordinat?** Mermiler `(açı, mesafe)` olarak saklanıyor. Kalkan çarpışması
tek bir açı karşılaştırmasına indiriyor — geometri hesabı yok.

**Neden `shadowBlur` yok?** Neon parlaması üst üste binen katmanlarla çiziliyor
(geniş+soluk → dar+parlak → beyaz çekirdek). `shadowBlur`'dan hem daha iyi görünüyor
hem çok daha hızlı; orta seviye telefonlarda 60fps'i bu koruyor.

**Ekran dışı uyarı okları.** Geniş ekranlarda mermiler görünür alanın çok dışından
başlıyor. Her mermi ekrana girene kadar, gireceği kenarda kendi renginde bir ok
yanıp söner — kırmızı dikeni de önceden görürsün.

**Erişilebilirlik.** `prefers-reduced-motion` açıksa ekran sarsıntısı kapanır ve parçacık
sayısı %70 düşer. Mermi tipleri sadece renkle değil şekille de ayrışır. Klavyeyle tam
oynanabilir.

**QA kancası.** `window.__deflect = { game, viewport }` — otomatik oynatma testinin
oyunu sürüp sonucu okuyabilmesi için. Sadece durum okur/yazar, oynanışı değiştirmez.

## Doğrulanmış durum

- 17/17 mantık testi geçiyor
- Konsol hatası yok (Chromium)
- 1280×720 ve 390×844'te düzen temiz
- Sabit 60 FPS (otomatik oynatma botu altında ölçüldü)

### Zorluk ölçümü

Mükemmel refleksli bir bot (16 ms tepki, en yakın bloklanabilir mermiye yönelir, kırmızı
dikenden kaçar) baştan sona doğal bir tur oynadığında:

| Ölçüm | Değer |
|-------|-------|
| Hayatta kalma | 154 saniye |
| Skor | 21 616 |
| En uzun seri | 174 blok |

Yani rampanın sonu, insanüstü bir oyuncuyu bile OVERDRIVE'a ulaşmadan durduruyor.
OVERDRIVE'ın kendisi de ölçüldü: bota zorlukta ileri sarma yapıldığında hayatta kalma
süresi 1.26x hızda 17 saniyeye, 1.95x hızda 5 saniyeye, 3.19x hızda 4 saniyeye düşüyor.
