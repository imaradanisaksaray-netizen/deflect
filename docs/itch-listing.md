# itch.io — kopyala-yapıştır formu

itch.io Cloudflare bot koruması kullandığı için otomatik yükleme yapılamıyor.
Aşağıdaki alanları sırayla kopyalayıp yapıştırman yeterli — 2-3 dakika sürer.

Başla: [itch.io/game/new](https://itch.io/game/new)

---

## Title

```
DEFLECT
```

## Project URL (Title'ın altındaki küçük alan)

```
deflect
```

## Short description or tagline

```
Block the light. Dodge the void. A neon reflex arcade you learn in ten seconds.
```

## Classification

`Games`

## Kind of project

`HTML` — bu şart. `Downloadable` seçilirse oyun tarayıcıda açılmaz.

## Release status

`Released`

## Pricing

`No payments`

---

## Description (uzun açıklama)

```
Block the light. Dodge the void.

A shield orbits your core. Cyan and gold shards have to be blocked. Red spikes
must NOT be touched — let them reach the core, which absorbs them harmlessly.

Four blocks in a row raise your multiplier, up to x8. Take a hit and it resets.
At 165 seconds OVERDRIVE begins: the speed climbs with no ceiling, so every run
ends eventually. The only question is how far you get first.

CONTROLS
Mouse, touch, or arrow keys / A-D. P pauses, M toggles sound, Space starts.

HOW IT WAS BUILT
Pure HTML5 and Canvas 2D. No engine, no libraries, no image or audio files —
28 KB in total. Every sound is generated in the browser at runtime. Runs at 60fps
and fits any aspect ratio, from a phone in portrait to an ultrawide monitor.

Source code: https://github.com/imaradanisaksaray-netizen/deflect
```

---

## Uploads

✅ **Yapıldı** — build butler ile yüklendi (kanal `html`, build #1846225).

Kanal adı `html` olduğu için itch.io bunu otomatik olarak
`This file will be played in the browser` diye işaretler. Yine de sayfada
gözle doğrula: işaretli değilse oyun oynanmaz, indirilir.

Yeni sürüm yüklemek için:

```bash
node tools/build-zip.mjs
butler push dist/deflect-playables.zip acubegame/deflect:html
```

## Embed options

| Ayar | Değer |
|------|-------|
| Viewport dimensions | `1280` × `720` |
| Fullscreen button | ✅ işaretle |
| Mobile friendly | ✅ işaretle |
| Orientation | Default |
| Automatically start on page load | isteğe bağlı (işaretlersen sayfa açılır açılmaz oyun başlar) |

---

## Genre

`Action`

## Tags (virgülle ayır, en fazla 10)

```
arcade, neon, synthwave, reflex, minimalist, html5, high-score, one-button, casual, singleplayer
```

## Screenshots

`docs/screenshots/` klasöründen sırayla yükle:

| Dosya | Ne gösteriyor |
|-------|---------------|
| `02-gameplay.png` | **İlk sıraya koy** — combo çarpanı ve aksiyon görünüyor, en iyi kapak bu |
| `03-overdrive.png` | OVERDRIVE anı |
| `01-menu.png` | Menü ekranı |
| `04-mobile.png` | Mobil düzen (mobil desteği kanıtlar) |

---

## Son adım

**Save & view page** → sayfa iyi görünüyorsa **Publish**.

Yayınladıktan sonra adresi bana ver; README'ye ve YouTube planına ekleyeyim.

---

## Sonraki sürümler

butler kurulu ve yetkilendirilmiş. Kod değişikliğinden sonra:

```bash
node --test tests/logic.test.mjs
node tools/build-zip.mjs
butler push dist/deflect-playables.zip acubegame/deflect:html
```

Tarayıcı ve Cloudflare devreye girmez, sayfa ayarları korunur. Sürüm numarası
her push'ta otomatik artar.
