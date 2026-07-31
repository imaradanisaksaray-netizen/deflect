# DEFLECT v2 — tasarım dokümanı

v1 tek oturumluk saf bir arcade: aç, oyna, öl, tekrar. v2 bunun üstüne **kalıcı
ilerleme**, **çeşitlenen tehditler**, **görsel kimlik değişimi**, **skor tablosu**
ve **mağaza dağıtımı** ekliyor.

Tasarımın tek kuralı: v1'in hissini bozmamak. Oyun hâlâ on saniyede öğrenilmeli ve
ilk tur hâlâ hiçbir menüye uğramadan başlamalı. Eklenen her sistem, o ilk turu
karmaşıklaştırmadan **arkada** birikmeli.

---

## 1. Meta ilerleme: neyi biriktiriyoruz?

v1'de tur bitince geriye sadece high score kalıyor. v2'de her tur üç şeye katkı yapar:

| Sayaç | Nasıl artar | Ne açar |
|-------|-------------|---------|
| **Toplam blok** | Bloklanan her mermi | Temalar |
| **En uzun seri** | Tek turdaki en uzun blok zinciri | Ustalık rozetleri |
| **Toplam mesafe** | Hayatta kalınan saniye | Yeni tehdit tipleri (zorluk katmanları) |

Neden üç ayrı sayaç: tek bir "XP" sayacı her şeyi aynı anda açar ve ilerleme
düzleşir. Üç eksen, farklı oyun tarzlarını ödüllendirir — biri uzun hayatta kalır,
biri agresif seri kovalar.

Hepsi `localStorage`'da, tek bir JSON kaydında (`deflect.profile.v2`). Sunucu yok,
hesap yok. Bozuk/eksik kayıt sessizce sıfırlanır (v1'deki try/catch disiplini aynen).

---

## 2. Tema sistemi — "tek temayla gitmesin"

Tema sadece renk paleti değiştirmez; **arka plan davranışını** da değiştirir. Aynı
oyun, farklı bir dünyada geçiyormuş gibi görünmeli.

| Tema | Palet | Arka plan karakteri | Açılış koşulu |
|------|-------|---------------------|---------------|
| **NEON** (başlangıç) | Cyan / magenta | Radyal ışınlar, mor derinlik | Açık |
| **EMBER** | Turuncu / kırmızı | Yükselen kor parçacıkları, sıcak sis | 500 blok |
| **TOXIC** | Asit yeşili / sarı | Titreşen ızgara, yeşil parazit | 1.500 blok |
| **ICE** | Buz mavisi / beyaz | Yavaş kar, kristal kırılmalar | 3.000 blok |
| **VOID** | Mor / beyaz | Yıldız alanı, kara delik çekimi | 6.000 blok |
| **SOLAR** | Altın / beyaz | Güneş patlamaları, lens parlaması | 10.000 blok |

Teknik olarak: `config.js` içindeki `colors` bloğu bir **tema nesnesine** dönüşür,
`background.js` tema başına bir "karakter fonksiyonu" alır. Render kodu değişmez,
sadece hangi temanın aktif olduğunu okur. Yeni tema eklemek = bir nesne + bir
arka plan fonksiyonu.

Oyuncu açtığı temalar arasında menüden seçim yapar. Kilitli temalar silüet olarak
görünür ve **ne kadar kaldığını** gösterir ("1.500 blok — 340 kaldı"). Kilit
ekranının görünür olması ilerleme hissinin yarısıdır.

---

## 3. Yeni tehditler — "yeni şeylere karşı korusun"

Tehditler tek seferde açılmaz; **toplam mesafeye** göre havuza girer. Böylece yeni
oyuncu üç mermi tipiyle öğrenir, deneyimli oyuncu altı tiple oynar.

| Tehdit | Davranış | Nasıl karşılanır | Havuza giriş |
|--------|----------|------------------|--------------|
| Cyan mermi | Düz gelir | Blokla | Başlangıç |
| Altın mermi | Hızlı gelir | Blokla, bonus puan | Başlangıç |
| Kırmızı diken | Düz gelir | **Dokunma**, geçmesine izin ver | Başlangıç |
| **Bölünen** | Bloklanınca ikiye ayrılır, parçalar yana savrulur | İki parçayı da yakala | 10 dk toplam |
| **Kabuklu** | İlk blok kabuğu kırar, ikinci blok yok eder | Aynı yerde iki kez blokla | 25 dk toplam |
| **Sahte** | Cyan görünür, kalkana yaklaşınca kırmızıya döner | Rengi dönünce çekil | 45 dk toplam |
| **Sürü** | 4-5 küçük mermi arka arkaya, tek yönden | Kalkanı sabit tut | 70 dk toplam |

Adalet kuralı v1'den devam: spawner asla aynı anda kalkanın yetişemeyeceği iki
bloklanabilir tehdit üretmez. Yeni tipler bu kontrole dahil edilir — özellikle
"bölünen", parçalarının varış açılarıyla birlikte hesaplanmalı.

**Sahte mermi** tasarımın en riskli parçası: renk değişimi çok geç olursa haksız
hissettirir. Kural: renk dönüşü kalkana varmadan **en az 0,6 saniye** önce
tamamlanır, ve dönüş anında belirgin bir titreşim/parlama olur.

---

## 4. Toplanabilir güçlendirmeler — "kalkan kazansın, can kazansın"

Tehditlerin arasında, seyrek olarak **toplanabilir** öğeler gelir. Bunlar
bloklanmaz; kalkanla **temas edilerek** alınır (yani cyan mermi gibi davranır ama
yok olmaz, etkisi başlar).

| Toplanabilir | Etki | Süre | Sıklık |
|--------------|------|------|--------|
| **Can** (kalp) | +1 can, maksimum 5 | Kalıcı | Çok seyrek (~2 dk'da bir şans) |
| **Kalkan genişletme** | Yay %60 genişler | 8 saniye | Seyrek |
| **Yavaşlatma** | Tüm mermiler %40 yavaşlar | 6 saniye | Seyrek |
| **Mıknatıs** | Cyan mermiler kalkana hafif çekilir | 10 saniye | Orta |
| **Nova** | Ekrandaki tüm bloklanabilir mermiler patlar, hepsi puan yazar | Anlık | Nadir |

Denge notu: bunlar zorluğu düşürmek için değil, **zorluk artışını taşınabilir
kılmak** için var. OVERDRIVE fazında güçlendirme sıklığı bir miktar artar; yoksa
sonsuz hızlanma sadece cezalandırıcı olur.

Görsel kural: güçlendirmeler mermilerden **şekil olarak** ayrışır (yumuşak, dolgulu,
nabız atan) ki oyuncu "bu bloklanacak bir şey değil" mesajını anında alsın.

---

## 5. Skor tablosu — bir karar noktası

İstenen: "oyuncuların skorları yazılsın". Bunun iki farklı anlamı var ve teknik
sonuçları çok farklı.

### Seçenek A — Cihaz-yerel tablo (önerilen ilk adım)
Kendi en iyi 10 skorun, tarihiyle birlikte. Tamamen offline, `localStorage`.
Oyunun "sıfır ağ isteği" özelliği korunur — ki bu Playables, Poki ve CrazyGames
başvurularında bizim en güçlü teknik kozumuz.

### Seçenek B — Küresel tablo (sunucu gerekir)
Tüm oyuncuların skorları. Gereken: bir backend (Supabase ücretsiz katman yeterli),
oyuncu takma adı, ve **anti-cheat**. Skor tablosu doğrulanmadığında ilk gün
sahte skorlarla dolar — istemci tarafı oyunlarda bu kaçınılmaz.

Maliyeti sadece sunucu değil: oyun artık ağ isteği yapar, gizlilik politikası
gerekir, portal başvurularında "external requests" sorusuna verdiğimiz cevap değişir.

### Seçenek C — Platform-native
Google Play'de Play Games Services, portallarda kendi leaderboard API'leri.
Her platformda ayrı entegrasyon, ama anti-cheat ve kimlik onların sorunu.

**Önerim:** A ile başla (bir günlük iş, hiçbir şeyi bozmaz), Google Play sürümünde
C ekle (Play Games Services zaten pakette). B'yi ancak oyuncu tabanı gerçekten
oluşursa düşün.

---

## 6. Reklamlar — bir endişe ve bir öneri

İstenen: "her öldüğünde restart yaparsa reklam girsin".

**Endişem:** Her ölümde tam ekran reklam, bu oyunun ritmini kırar. DEFLECT'te bir
tur 1-3 dakika ve ölüm sık; oyuncu "tekrar" tuşuna refleksle basıyor. Her seferinde
reklam görmek, hyper-casual oyunlarda ölçülmüş biçimde **oturum süresini ve geri
dönüş oranını düşürür**. Kısa vadede gösterim sayısı artar, uzun vadede oyuncu
kaybedilir.

**Önerim — aynı geliri daha az acıyla toplayan yapı:**

| Reklam tipi | Ne zaman | Neden |
|-------------|----------|-------|
| **Interstitial** | Her **3.** ölümde, **ve** son reklamdan en az 90 saniye geçmişse | Sıklık sınırı olmadan oyuncu kaçar; iki koşulun birlikte olması hem hızlı ölen hem uzun oynayan oyuncuyu korur |
| **Rewarded** (ödüllü) | Ölüm ekranında "**bir can karşılığı izle**" seçeneği | Oyuncu **kendi** seçiyor, tamamlanma oranı yüksek, gelir başına değeri interstitial'ın birkaç katı |
| **Banner** | Yok | Oyun tam ekran ve merkez tabanlı; banner kadrajı bozar |

Yine de her ölümde istiyorsan onu da yaparım — tek sayı değişikliği (`adEveryNDeaths: 1`).
Ama en azından 90 saniyelik minimum aralığı bırakmayı öneririm.

Teknik: reklam çağrıları tek bir `ads.js` arayüzünün arkasına alınır. Web
portallarında CrazyGames/Poki SDK'sı, Google Play sürümünde AdMob aynı arayüzü
uygular. Oyun kodu hangi ağın çalıştığını bilmez.

---

## 7. Google Play — paketleme yaklaşımı

Oyun HTML5; Play'e koymak için native bir kabuk gerekiyor.

| Yöntem | Artı | Eksi |
|--------|------|------|
| **TWA** (Trusted Web Activity) | En hafif, siteyi doğrudan sarar | İnternet zorunlu, AdMob entegrasyonu sorunlu |
| **Capacitor** (önerilen) | Offline çalışır, AdMob ve Play Games eklentileri var, tek kod tabanı | Build zinciri kurmak gerekir (Android Studio, JDK) |
| Native yeniden yazım | En iyi performans | Oyunu sıfırdan yazmak demek, anlamsız |

**Önerim: Capacitor.** Oyun zaten tek klasör statik; Capacitor onu bir WebView
uygulamasına sarar, AdMob eklentisi reklamları, Play Games eklentisi skor tablosunu
verir.

**Senin yapman gerekenler (ben yapamam):**
- Google Play Console geliştirici hesabı — **tek seferlik 25 USD**
- İmzalama anahtarı oluşturma (parola içerir)
- Store listing: içerik derecelendirme anketi, gizlilik politikası URL'si

Gizlilik politikası: reklam SDK'sı veri topladığı için **zorunlu**. Basit bir sayfa
yeterli, GitHub Pages'te yayınlarız.

---

## 8. Menü ve ekran akışı

v1'de tek ekran vardı. v2'de yapı:

```
AÇILIŞ
  └─ ANA MENÜ ──── OYNA (doğrudan tur başlar)
                ├─ TEMALAR    (açılanlar + kilitliler ve koşulları)
                ├─ SKORLAR    (en iyi 10, istatistikler)
                ├─ AYARLAR    (ses, titreşim, azaltılmış hareket)
                └─ NASIL OYNANIR (3 kartlık animasyonlu anlatım)

TUR SONU
  └─ SKOR EKRANI ── TEKRAR (reklam kuralına göre)
                 ├─ CAN KARŞILIĞI İZLE (rewarded)
                 └─ MENÜ
```

**Kritik kural:** oyunu ilk kez açan biri **Oyna**'ya basıp hiçbir şey öğrenmeden
oynayabilmeli. Menü, ilerleme biriktikçe anlam kazanan bir katman; giriş engeli değil.

Yeni tema veya rozet açıldığında tur sonu ekranında bir kutlama kartı çıkar —
oyuncu menüye girmeden ne kazandığını görür.

---

## 9. Teknik mimari değişiklikleri

v1'in modüler yapısı bunu taşıyabilecek durumda. Eklenecekler:

```
src/
  progress/
    profile.js      Kalıcı profil (blok, seri, süre, açılanlar)
    unlocks.js      Açılış kuralları ve kontrolü
  themes/
    index.js        Tema kayıt defteri
    neon.js ...     Her tema: palet + arka plan karakteri
  entities/
    powerups.js     Toplanabilirler
  systems/
    ads.js          Reklam arayüzü (SDK-agnostik)
    leaderboard.js  Yerel tablo (sonra: platform adaptörü)
  screens/
    menu.js, themes.js, scores.js, settings.js, howto.js
```

Mevcut dosyalar korunur; `config.js` içindeki `colors` bloğu tema sistemine taşınır.

**Boyut etkisi:** v1 28 KB. Tahminim v2 için 55-70 KB — hâlâ portalların limitlerinin
çok altında ve hâlâ tek ağ isteği yok (reklam SDK'sı hariç, o da portal tarafından
yükleniyor).

---

## 10. Uygulama sırası

Her faz kendi başına bitirilebilir ve yayınlanabilir:

| Faz | İçerik | Tahmini büyüklük |
|-----|--------|------------------|
| **1** | Profil altyapısı + tema sistemi + 3 yeni tema | Orta |
| **2** | Yeni tehdit tipleri + adalet kontrolüne entegrasyon | Orta |
| **3** | Toplanabilir güçlendirmeler + denge ayarı | Orta |
| **4** | Menü/ekran mimarisi + nasıl oynanır | Büyük |
| **5** | Yerel skor tablosu + istatistikler + rozetler | Küçük |
| **6** | Reklam arayüzü + web portal SDK entegrasyonu | Orta |
| **7** | Capacitor paketleme + AdMob + Play Games + store listing | Büyük |

Faz 1-5 tamamen web; her biri bittiğinde itch.io ve GitHub Pages otomatik güncellenir.
Faz 6-7 mağaza tarafı.

---

## 11. Karar noktaları — senin onayın gerekiyor

1. **Skor tablosu:** Yerel (A) ile mi başlayalım, yoksa küresel (B) için sunucu
   kurayım mı? Küresel, oyunun "sıfır ağ isteği" avantajını ve portal
   başvurularındaki teknik konumumuzu değiştirir.

2. **Reklam sıklığı:** Önerdiğim 3 ölüm + 90 saniye kuralı mı, yoksa istediğin gibi
   her ölümde mi?

3. **Google Play:** Capacitor yolunu onaylıyor musun? 25 USD geliştirici hesabı ve
   imzalama anahtarı senin tarafında.

4. **Sıra:** Faz 1'den mi başlayayım (tema + ilerleme, en görünür değişiklik), yoksa
   önce oynanış derinliği (Faz 2-3) mi?

Not: CrazyGames incelemesi şu an sürüyor. v2 çalışması v1'i bozmaz — ayrı dalda
geliştirip inceleme sonuçlandıktan sonra yayınlamak en temizi.
