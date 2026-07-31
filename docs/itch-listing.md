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

`dist/deflect-playables.zip` dosyasını yükle.

**Yükleme bitince dosyanın altındaki `This file will be played in the browser`
kutusunu işaretle.** İşaretlenmezse oyun oynanmaz, indirilir. En sık yapılan hata bu.

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

## Sonraki sürümleri otomatik yüklemek

Proje bir kez oluşturulduktan sonra, itch.io'nun resmi aracı `butler` ile yeni
sürümler tek komutla yüklenebilir — tarayıcı ve Cloudflare devreye girmez:

```bash
butler push dist/deflect-playables.zip imaradanisaksaray-netizen/deflect:html
```

Kurulum: [itch.io/docs/butler](https://itch.io/docs/butler). Bir kez
`butler login` yaparsın (tarayıcıda yetkilendirme, parola girilmez), sonrasında
push komutunu ben de çalıştırabilirim.
