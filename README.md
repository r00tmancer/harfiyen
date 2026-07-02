# Harfiyen

1v1 gerçek zamanlı Türkçe kelime düellosu. İki oyuncu birer harf seçer; seçilen harflerden biriyle başlayıp diğeriyle biten, TDK sözlüğünde bulunan bir kelimeyi ilk yazan puanı alır. 5 puana ulaşan maçı kazanır.

- **İstemci**: Vite + React + TypeScript, GitHub Pages üzerinde statik.
- **Sunucu**: Cloudflare Worker + Durable Object (oda başına bir nesne), WebSocket Hibernation.
- **Kelime doğrulama**: TDK Güncel Türkçe Sözlük'ten türetilmiş ~62 bin kelimelik gömülü liste — çevrimdışı, deterministik, <1 ms.

## Geliştirme

```bash
npm install
npm run data          # kelime listesini üretir (tek seferlik, çıktılar commit'lidir)
npm run dev:worker    # http://localhost:8787
npm run dev:web       # http://localhost:5173
```

## Dağıtım

- Worker: `npm run deploy:worker`
- Web: `main`'e push → GitHub Actions → GitHub Pages

## Veri kaynakları ve atıflar

- Kelime listesi: [ogun/guncel-turkce-sozluk](https://github.com/ogun/guncel-turkce-sozluk) (MIT) — TDK Güncel Türkçe Sözlük 12. baskı dökümünden filtrelenmiştir.
- Takma ad küfür filtresi: [ooguz/turkce-kufur-karaliste](https://github.com/ooguz/turkce-kufur-karaliste) (CC-BY-SA-4.0).
