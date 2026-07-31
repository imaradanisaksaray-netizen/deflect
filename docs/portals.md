# HTML5 oyun portalları — başvuru rehberi

Playables'a girmenin en gerçekçi yolu, birkaç ay sonra **gerçek kullanıcı sayısıyla**
tekrar başvurmak. Bu portallar o sayıyı üreten yer.

## Teknik uyum denetimi

Oyun, aşağıdaki portalların gereksinimlerine **kod değişikliği olmadan** uyuyor:

| Kriter | Kim istiyor | Gereken | DEFLECT |
|--------|-------------|---------|---------|
| Dış ağ isteği | Poki (katı) | Hiç olmamalı | Sıfır — CDN, font, analytics yok |
| Göreli yollar | CrazyGames | Zorunlu | Tümü göreli |
| localStorage try/catch | Poki (Incognito) | Zorunlu | [storage.js](../game/src/storage.js) |
| Splash / dış link | Poki | Olmamalı | Yok |
| Ad blocker ile oynanabilirlik | Poki | Zorunlu | Reklam yok, etkilenmez |
| Dosya sayısı | CrazyGames | < 1500 | 22 |
| İlk indirme boyutu | CrazyGames | < 50 MB | 28 KB |
| Oyuna ulaşma süresi | CrazyGames | < 20 sn | Anında |
| Mobil + dokunma | Poki, CrazyGames | Zorunlu | Destekli |

Yükleme dosyası her portalda aynı: `dist/deflect-playables.zip`.

---

## Öncelik sırası

### 1. CrazyGames — GÖNDERİLDİ (31 Temmuz 2026)

**Durum: AWAITING REVIEW.** Build ID `973640fb-8c97-4b4b-9444-0d1679b53302`,
kategori Arcade, Basic Launch (SDK'sız). CrazyGames'in kendi QA ortamında oyun
çalıştırıldı ve doğrulandı; portal toplam boyutu 0,1 MB olarak raporladı.

Süreçte öğrenilenler:

- **ZIP kabul edilmiyor.** "Archive files are not supported" — dosyalar arşivsiz,
  doğrudan sürükle-bırak ile yükleniyor. `index.html` en üst düzeyde olmalı,
  klasörün kendisi değil içindekiler seçilmeli.
- **5 medya zorunlu:** kapak görselleri 1920×1080, 800×1200, 800×800 ve iki tanıtım
  videosu (yatay + dikey). Videolar **en fazla 20 saniye**.
- Progress save sorusunda doğru yanıt "Yes, using LocalStorage" — oyun yüksek skoru
  orada tutuyor ve portal bunu kullanıcı hesabıyla eşitleyebiliyor.

Sonraki sürüm için not: portal ortamında oyun iframe içinde çalışıyor ve odak
kolayca kayıyor. `main.js` içindeki `blur` dinleyicisi her odak kaybında oyunu
duraklatıyor; `visibilitychange` zaten sekme değişimini yakaladığı için `blur`
dinleyicisi kaldırılabilir. Portal deneyimini yumuşatır.

### 1b. CrazyGames — süreç referansı

**Neden ilk:** SDK entegrasyonu **Basic Launch için opsiyonel** (yalnızca tam reklam
geliri için zorunlu). Yani oyunu bugünkü haliyle gönderebilirsin. Münhasırlık
istemiyor — itch.io ve diğer portallarda kalabilirsin.

Başvuru: [developer.crazygames.com/games](https://developer.crazygames.com/games)
Hesap gerekli.

**Bizim profilimiz onların aradığına uyuyor:** ilk on saniyede kancaya takan, kısa
oturumlu, hızlı yüklenen casual oyunlar öne çıkıyor. Uzun eğitim isteyen veya yavaş
açılan oyunlar eleniyor.

### 2. Newgrounds — en hızlı kazanç

Onay süreci yok, hesap açıp yükleyince yayında. Trafik CrazyGames/Poki kadar değil
ama anında görünürlük ve topluluk geri bildirimi verir.

Başvuru: [newgrounds.com](https://www.newgrounds.com) → hesap → Submit → Game

### 3. Poki — en yüksek trafik, en seçici

Teknik gereksinimlerine birebir uyuyoruz (özellikle "sıfır dış istek" kuralı, ki
çoğu oyun burada takılır). Ancak süreç çok aşamalı: Feedback & Playtesting → Player
Fit Test → Web Fit Test → Final Poki Review. Onay sonrası Poki SDK entegrasyonu
zorunlu.

Başvuru: [sdk.poki.com](https://sdk.poki.com) üzerinden geliştirici kaydı.

### 4. GameDistribution / Playgama

Dağıtım ağları — oyunu birçok küçük siteye birden dağıtırlar. Reklam geliri paylaşımı
için SDK entegrasyonu isterler. CrazyGames ve Poki oturduktan sonra bakılabilir.

---

## Hazır başvuru metinleri

Her portalda aynı metinleri kullan; tutarlı kimlik arama sonuçlarında işe yarar.

### Başlık
```
DEFLECT
```

### Kısa açıklama
```
Block the light. Dodge the void. A neon reflex arcade you learn in ten seconds.
```

### Uzun açıklama
```
A shield orbits your core. Cyan and gold shards have to be blocked. Red spikes must
NOT be touched - let them reach the core, which absorbs them harmlessly.

Four blocks in a row raise your multiplier, up to x8. Take a hit and it resets. At
165 seconds OVERDRIVE begins: the speed climbs with no ceiling, so every run ends
eventually. The only question is how far you get first.

Controls: mouse, touch, or arrow keys. Works on phone and desktop.

Built in pure HTML5 and Canvas 2D - no engine, no libraries, no asset files. 28 KB
total, instant load, locked 60fps, and the playfield is identical on every aspect
ratio.
```

### Etiketler
```
arcade, reflex, neon, synthwave, minimalist, one-button, high-score, casual, skill, singleplayer
```

### Kategori
Action / Arcade

### Görseller
`docs/screenshots/` klasöründe. Kapak için `cover-menu.png` (630×500),
ekran görüntüleri için `02-gameplay.png`, `03-overdrive.png`, `01-menu.png`,
`04-mobile.png`.

---

## Süreç notu

Her portal geliştirici hesabı ister ve oyun dosyasını kendi arayüzünden yükletir.
Hesap açma ve dosya yükleme adımları hesap sahibinde; geri kalan her şey
(metinler, görseller, teknik uyum, paket) hazır.
