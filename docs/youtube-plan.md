# YouTube oyun kanalı — durum ve yol haritası

Bu doküman, "YouTube'a oyun yükleme" araştırmasının sonucunu ve DEFLECT için
uygulanabilir yayın planını içerir. Araştırma tarihi: 31 Temmuz 2026.

## 1. "YouTube'a oyun yüklemek" üç ayrı şey demek

### A. YouTube Playables — oyun YouTube içinde oynanır

Oyunlar HTML5/WebGL tabanlı. Unity, Godot, Phaser, three.js, PixiJS, Construct,
Cocos, Defold, PlayCanvas, BabylonJS, melonJS gibi web'e build alabilen motorlar
destekleniyor. Saf web platform API'leri de geçerli (bizim durumumuz).

**Erişim kapalı.** Developer Portal'a girmek için ilgi formu (interest form)
doldurup onay beklemek gerekiyor. Süreç haftalar-aylar sürebiliyor ve kabul garantisi
yok. 2026 itibarıyla herkese açık self-servis yayınlama yok.

Onay geldiğinde gönderim şu adımlardan oluşuyor:
1. Metadata: başlık, tür, açıklama, yayıncı ve geliştirici bilgisi
2. Oyun paketi: ZIP (kökünde `index.html`)
3. Thumbnail: tasarım gereksinimlerine uygun
4. Monetizasyon: interstitial ve rewarded reklam ayarları

Zorunlu teknik kurallar: native kod/plugin yok, hızlı açılış, her ekran çözünürlüğü
ve oranında responsive, her ölçekte net render (bulanık/pikselli/gerilmiş olmayacak).

### B. Playables Builder — Gemini 3 ile kodsuz oyun üretimi

Kapalı beta. Yalnızca **ABD, Kanada, İngiltere, Avustralya**. Türkiye'den erişim yok.
Bizim için şu an bir seçenek değil.

### C. Normal oyun kanalı — video ve Shorts

Tamamen serbest, onay gerekmiyor. Bugün başlanabilir. Kısa vadede tek gerçekçi yol bu.

## 2. Strateji: onayı beklemeden ilerle

DEFLECT zaten Playables kurallarına göre yazıldı (tek klasör HTML5, bağımlılıksız,
responsive, 26 KB). Yani:

- **Bugün:** oyunu web'de yayınla, oynanış klipleriyle kanalı başlat.
- **Onay gelirse:** `node tools/build-zip.mjs` çıktısını portala yükle. Yeniden yazım yok.

### Playables başvurusu

İlgi formunu doldur. Formda işine yarayacak somut veriler:

| Alan | Değer |
|------|-------|
| Teknoloji | Saf HTML5 / Canvas 2D, motor yok |
| Paket boyutu | 26 KB (sıkıştırılmış), 67 KB ham |
| Dış bağımlılık | Yok — CDN, font, görsel, ses dosyası yok |
| Açılış süresi | İlk kare anında; ağ isteği yok |
| Responsive | Playfield `min(genişlik, yükseklik)` tabanlı, her oranda birebir |
| Girdi | Fare, dokunma, klavye |
| Erişilebilirlik | `prefers-reduced-motion` desteği, şekil+renk ayrımı |

Başvuru öncesi oyunun **canlı ve oynanabilir bir URL'si** olması isteniyor — bu yüzden
önce yayınla, sonra başvur.

### Nereye yayınlanır (bugün)

| Platform | Neden |
|----------|-------|
| **itch.io** | HTML5 oyunlar için standart; gömülebilir, ücretsiz, kendi sayfası olur |
| **GitHub Pages** | Statik, ücretsiz, doğrudan `game/` klasörü servis edilir |
| **Playgama / GameDistribution** | HTML5 oyun ağları; trafik ve reklam paylaşımı sağlar |

En hızlısı GitHub Pages: `game/` klasörünü repo köküne alıp Pages'i aç.

## 3. Kanal içerik planı

Oyun İngilizce ve küresel hedefli, dolayısıyla kanal da İngilizce.

### Shorts (ana motor)

Shorts, yeni kanalın keşfedilme yolu. DEFLECT bunun için tasarlandı: turlar kısa,
ölüm anı net, skor hızla artıyor.

Format fikirleri:
- **"Can you beat my score?"** — 30-50 saniyelik tur, ekranda skor, sonda meydan okuma
- **Yakın kaçışlar** — kırmızı dikenin kalkanın 1 piksel yanından geçtiği anlar
- **Combo tırmanışı** — x1'den x8'e çıkışın hızlandırılmış hali
- **"I made a game in one sitting"** — yapım süreci, kod ekranı + oyun
- **Zorluk denemesi** — gözü kapalı, tek elle, sadece klavyeyle

### Uzun video (derinlik)

- Oyunun nasıl yapıldığı: polar koordinat çarpışması, neon glow tekniği, spawn adaleti
- "Neden 26 KB?" — Unity WebGL yerine vanilla JS seçiminin anlatımı
- Playables başvuru süreci günlüğü

### Yükleme ritmi

Haftada 3-5 Short + 2 haftada 1 uzun video sürdürülebilir bir başlangıç. Tek bir
20 dakikalık oynanış kaydından 5-8 Short çıkarılabilir.

## 4. Video üretimi

`ffmpeg` sistemde kurulu. Ekran kaydından Shorts formatına (dikey 1080×1920) geçiş:

```bash
ffmpeg -i kayit.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920" -c:v libx264 -crf 18 -c:a aac short.mp4
```

Oyun merkez tabanlı olduğu için ortadan dikey kırpma tüm aksiyonu korur — kalkan,
çekirdek ve gelen mermiler kadrajda kalır. Bu, tasarımın Shorts'a uygun olmasının
somut faydası.

Tarayıcıyı 1080×1920 boyutunda açıp doğrudan dikey kaydetmek daha da temiz sonuç verir;
oyun o oranda da sorunsuz çalışır.

## 5. Sıradaki adımlar

1. `game/` klasörünü GitHub Pages veya itch.io'ya yayınla, canlı URL al
2. Playables ilgi formunu bu URL ile doldur
3. Kanalı aç, adı ve görsel kimliği oyunla aynı olsun (neon/synthwave)
4. İlk 5 Short'u tek oturumda kaydedip programa bağla
5. Onay gelirse `dist/deflect-playables.zip` dosyasını portala yükle

## Kaynaklar

- [YouTube Playables — geliştirici dokümantasyonu](https://developers.google.com/youtube/gaming/playables)
- [Playables Developer Portal](https://developers.google.com/youtube/gaming/playables/developer_portal)
- [Playables tasarım gereksinimleri](https://developers.google.com/youtube/gaming/playables/certification/requirements_design)
- [Playables Builder duyurusu (9to5Google)](https://9to5google.com/2025/12/23/youtube-playables-builder/)
- [Playables Builder — Türkçe özet (Webrazzi)](https://webrazzi.com/2025/12/17/youtube-un-gemini-3-destekli-oyun-uretim-platformu-playables-builder/)
- [Oyun gönderme rehberi (Playgama Wiki)](https://wiki.playgama.com/platforms/how-to-publish-your-game-on-youtube-playables)
