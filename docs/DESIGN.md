# Harfiyen tasarım sistemi — "Şekerleme"

Ton: renkli, tatlı, oyuncak gibi. Duolingo × Candy Crush × Kahoot enerjisi.
ASLA: koyu neon, glassmorphism, jenerik gradient blob, kurumsal gri.

## Palet (`:root` CSS custom properties)

```css
--bg: #FFF6EC;        /* krem sayfa zemini */
--bg-2: #FFEEDD;      /* ikincil zemin, dalga/desen */
--card: #FFFFFF;
--ink: #3F3D56;       /* ana metin + konturlar */
--ink-soft: #6E6A8F;  /* ikincil metin */
--p1: #FF6FA9;  --p1-dark: #E44B8D;  --p1-soft: #FFE1EE;   /* oyuncu 1: şeker pembesi */
--p2: #4FB8FF;  --p2-dark: #2E9BE8;  --p2-soft: #E0F2FF;   /* oyuncu 2: gök mavisi */
--sun: #FFC93C;       /* yıldız/skor sarısı */
--mint: #3EDBB2;
--grape: #A78BFA;
--ok: #38D9A9;        /* kabul yeşili */
--err: #FF6B6B;       /* red mercanı */
```

## Şekil dili

- border-radius 16–24px; harf taşları 20px.
- Önemli parçalar (butonlar, taşlar, kartlar): `3px solid var(--ink)` kontur + offset gölge
  `box-shadow: 0 6px 0 color-mix(in srgb, var(--ink) 18%, transparent)`.
- Butona basınca squish: `translateY(4px)` + gölge 2px'e iner (aktif durum).
- Zemin düz krem; istenirse çok soluk büyük puantiye/konfeti deseni (CSS ile, görsel dosya yok).

## Tipografi

- Başlık + harf taşları + sayılar: **Baloo 2** (700–800).
- Gövde/UI: **Nunito** (600–800).
- İkisi de Google Fonts latin-ext; `<html lang="tr">` ZORUNLU (i→İ dönüşümleri için).

## Bileşenler

- **Harf taşı**: 72×72px, beyaz zemin, ink kontur, ortada Baloo 800 ~40px harf (BÜYÜK yazılır: K, A). Taşlar şeker gibi hafif rotasyonlu dursun (-3° / +2°).
- **Skor**: oyuncu başına 5 yıldız yuvası (boş = soluk kontur, dolu = --sun + jelly bounce). 5. yıldız maçı bitirir.
- **Avatarlar**: 8 kawaii inline SVG karakter (yıldız, kalp, bulut, şimşek, damla, çiçek, elmas, ay). Basit yüz: 2 nokta göz + gülümseme yayı. Gövde rengi oyuncunun kimlik rengine boyanır. EMOJİ KULLANILMAZ.
- **İkonlar**: küçük inline SVG (kopyala, paylaş, ses aç/kapa, geri, kupa). Kütüphane yok, elle çizilir, stroke=ink.

## Hareket (GSAP)

- Giriş/eleman doğuşu: `back.out(1.7)` — her şey hafif zıplayarak gelir.
- Harf reveal: taşlar yukarıdan düşer, iki kez seker; çarpışma anında minik toz partikülü.
- Kabul edilen kelime: harf harf yeşile döner + scale punch; canvas-confetti patlaması (partiküller kazanan oyuncunun renginde, `useWorker: true`).
- Reddedilen: input x-ekseni wobble (gsap keyframes) + 150ms --err kenarlık flaşı.
- Geri sayım: dev Baloo rakamları 3→2→1, scale 1.6→1 punch + tick sesi; "BAŞLA!" yazısı patlayarak dağılır.
- Maç sonu: confetti yağmuru (2sn) + kupa kartı bounce.
- `prefers-reduced-motion: reduce` → tüm dekoratif animasyonlar kapalı, confetti `disableForReducedMotion`.

## Ses (Web Audio, dosyasız synth)

- pop (kabul): sine 880→1320Hz, 80ms; buzz (red): square 110Hz, 150ms;
  tick (sayım): triangle 1568Hz, 40ms; fanfare (zafer): C-E-G-C arpej.
- İlk kullanıcı jestinde `ctx.resume()`. Sağ üstte ses aç/kapa (localStorage'da saklanır).

## Yerleşim

- Mobil öncelikli: oyun kolonu `max-width: 480px`, ortalanmış; masaüstünde kenarlarda dekoratif boşluk.
- Dokunma hedefleri ≥ 48px; text input `font-size ≥ 16px` (iOS zoom engellemek için).
- Ekranlar: **Ana** (logo + takma ad + avatar seçimi + "Oda kur" / "Koda katıl"),
  **Lobi** (dev oda kodu, "linki kopyala", rakip bekleniyor animasyonu, "Hazırım" butonu),
  **Oyun** (üst: avatar + yıldızlar × 2; orta: faza göre içerik; alt: kelime input + gönder),
  **Zafer** (kupa, skorlar, "Rövanş" / "Yeni oda").

## Metin tonu

Samimi, kısa, oyuncu diliyle: "Hazırım", "Rakip bekleniyor...", "Harfini seç!", "BAŞLA!",
"Bu kelime zaten kullanıldı", "TDK'da yok :(" yerine "Sözlükte bulunamadı". Ünlem az, emoji hiç.
