# Harfiyen — plan ve mimari

## Oyun kuralı (kesin, kullanıcı onaylı)

1. İki oyuncu aynı anda gizlice birer harf seçer (10 sn; seçmeyene rastgele atanır).
2. Sunucu çifti kontrol eder: bu iki harfle (X ile başlayıp Y ile biten VEYA Y ile başlayıp X ile
   biten, min 3 harf) en az `MIN_PAIR_WORDS` kelime yoksa çift otomatik yeniden çekilir.
3. 3-2-1 geri sayım → harfler açıklanır → yarış başlar (45 sn).
4. Geçerli kelimeyi (TDK listesinde var + desen uyuyor + bu maçta kullanılmamış) İLK yazan 1 puan alır.
5. Raund sonucu kısaca gösterilir (kelime + TDK anlamı) → yeni harf seçimi.
6. **5 puana ulaşan maçı kazanır.** 45 sn'de kimse bulamazsa puan verilmez, harfler yenilenir.

## Mimari

- `web/` — Vite + React + TS istemcisi → GitHub Pages (`base: '/harfiyen/'`, hash tabanlı oda linki `#/oda/KOD`).
- `worker/` — Cloudflare Worker: `POST /api/rooms` (oda kur), `GET /api/rooms/:code`, `WS /ws/:code`.
  Origin allowlist kontrolü upgrade'den ÖNCE yapılır (WS CORS'a tabi değildir!).
- `GameRoom` Durable Object (SQLite-backed, free plan → `new_sqlite_classes`):
  WebSocket Hibernation API (`ctx.acceptWebSocket`), faz süreleri `ctx.storage.setAlarm`
  (setTimeout KULLANILMAZ — hibernation'ı bozar). Oyun durumu `ctx.storage`'da; soket kimliği
  `serializeAttachment` ile (pid) — uyanınca `getWebSockets()` ile geri alınır.
- `shared/` — protokol sözleşmesi (`src/protocol.ts`). Tek gerçek kaynak.
- `tools/` — kelime listesi üretimi; çıktılar `worker/src/data/` altına COMMIT edilir.

## Kelime doğrulama

- Kaynak: ogun/guncel-turkce-sozluk (MIT, TDK 12. baskı). `ozel_mi=0`, tek kelime,
  tr-TR küçük harf, â/î/û→a/i/u, dedupe → ~62k kelime (`words.txt`, ~180KB gzip).
- Worker'da ilk istekte lazy `Set` (global scope'ta AĞIR parse yapılmaz — 1sn startup limiti).
- `pairs.json`: sırasız harf çifti → çözüm sayısı (min 3 harf). Çift kabulü buradan.
- Canlı sozluk.gov.tr SADECE raund sonu anlam göstermek için, asenkron, 1.5sn timeout,
  DO storage'da cache. Oyun akışını asla bloklamaz.

## Fazlar

0. ✅ İskelet + protokol + CI/CD
1. Kelime motoru (tools + data)
2. GameRoom DO + oda akışı
3. Harf Düellosu MVP (oynanabilir)
4. Candy tasarım + VFX cilası (bkz. DESIGN.md)
5. Sayı Avı modu
6. Kelime Zinciri, İsim-Şehir, D1 skor tablosu, PWA
