# Yayın rehberi

DEFLECT iki yere yayınlanıyor:

| Nereye | Ne için |
|--------|---------|
| **itch.io** | Oyuncu trafiği ve kendi oyun sayfası. Shorts açıklamasına konacak link bu. |
| **GitHub Pages** | Kararlı URL + açık kaynak. Playables başvurusunda verilecek adres bu. |

Her ikisi de ücretsiz.

---

## 1. itch.io

Yükleme dosyası zaten hazır: `dist/deflect-playables.zip`. Yoksa üret:

```bash
node tools/build-zip.mjs
```

Aynı ZIP hem itch.io hem Playables için geçerli — `index.html` arşiv kökünde.

### Adımlar

1. [itch.io](https://itch.io/register) üzerinden ücretsiz hesap aç.
2. Dashboard → **Create new project**.
3. Alanları şöyle doldur:

| Alan | Değer |
|------|-------|
| Title | `DEFLECT` |
| Project URL | `deflect` |
| Short description | `Block the light. Dodge the void. A neon reflex arcade.` |
| Classification | Games |
| Kind of project | **HTML** |
| Release status | Released |
| Pricing | No payments |

4. **Uploads** → `dist/deflect-playables.zip` dosyasını yükle, ardından
   **"This file will be played in the browser"** kutusunu işaretle. Bu kutu
   işaretlenmezse oyun indirilir, oynanmaz.

5. **Embed options**:

| Ayar | Değer | Neden |
|------|-------|-------|
| Viewport dimensions | `1280 × 720` | 16:9, Shorts kaydı için de doğru oran |
| Fullscreen button | **açık** | Oyun tam ekranda çok daha iyi |
| Mobile friendly | **açık** | Oyun dokunmatikte tam çalışıyor |
| Orientation | Default | Her iki yönde de sorunsuz |

6. **Genre**: Action. **Tags**: `arcade`, `neon`, `synthwave`, `reflex`,
   `minimalist`, `html5`, `one-button`, `high-score`.

7. Görseller `docs/screenshots/` klasöründe:
   - `01-menu.png` — kapak görseli olarak da kullanılabilir
   - `02-gameplay.png` — combo çarpanının göründüğü kare
   - `03-overdrive.png` — OVERDRIVE anı
   - `04-mobile.png` — mobil düzen kanıtı

8. **Save & view page** → sayfa iyi görünüyorsa **Publish**.

---

## 2. GitHub Pages

Depo hazır, ilk commit atıldı, otomatik deploy workflow'u yazıldı
(`.github/workflows/deploy-pages.yml`). Workflow önce 17 testi çalıştırır,
sadece hepsi geçerse `game/` klasörünü yayına alır — bozuk bir sürüm canlıya çıkamaz.

### Adım 1 — GitHub'a giriş yap (bunu sen yapmalısın)

```bash
gh auth login
```

Sorulara: **GitHub.com** → **HTTPS** → **Login with a web browser**. Tarayıcı açılır,
ekrandaki kodu girip yetki verirsin.

### Adım 2 — Depoyu oluştur ve gönder

```bash
gh repo create deflect --public --source=. --push
```

> Ücretsiz GitHub hesabında Pages yalnızca **public** depolarda çalışır, bu yüzden
> `--public`. Kod açık olacak.

### Adım 3 — Pages'i Actions kaynağıyla aç

```bash
gh api "repos/{owner}/deflect/pages" -X POST -f build_type=workflow
```

### Adım 4 — Deploy'u izle

```bash
gh run watch
```

Bittiğinde adres: `https://<kullanıcı-adın>.github.io/deflect/`

Sonraki her `git push`, testler geçtiği sürece siteyi otomatik günceller.

---

## 3. Playables başvurusu

Canlı URL çıktıktan sonra ilgi formunu doldur. Formda işine yarayacak veriler
[youtube-plan.md](youtube-plan.md) içindeki tabloda. Başvuruda GitHub Pages
adresini ver — itch.io sayfası oyunu bir iframe içine sardığı için doğrudan
oynanabilir adres olarak Pages daha temiz.

Onay gelirse portala yüklenecek dosya yine `dist/deflect-playables.zip`.

---

## Sonraki güncellemeler

```bash
# Kod değişikliğinden sonra
node --test tests/logic.test.mjs
git add -A
git commit -m "fix: ..."
git push                      # GitHub Pages otomatik güncellenir

node tools/build-zip.mjs      # itch.io için yeni ZIP üret ve elle yükle
```
