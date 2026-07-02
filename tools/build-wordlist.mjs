#!/usr/bin/env node
// Harfiyen kelime listesi uretici.
// Kaynak: ogun/guncel-turkce-sozluk (TDK 12. baski dump'i, JSON-lines).
// Ulasilamazsa yedek: sozluk.gov.tr/autocomplete.json (ozel_mi yok, buyuk harfle
// baslayanlar ozel isim sayilir).
// Ciktilar: worker/src/data/{words.txt, pairs.json, badwords.json}

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(TOOLS_DIR, '.cache');
const DATA_DIR = path.join(TOOLS_DIR, '..', 'worker', 'src', 'data');

const GTS_URL =
  'https://raw.githubusercontent.com/ogun/guncel-turkce-sozluk/master/sozluk/v12/v12.gts.json.tar.gz';
const FALLBACK_URL = 'https://sozluk.gov.tr/autocomplete.json';
const BADWORDS_URL =
  'https://raw.githubusercontent.com/ooguz/turkce-kufur-karaliste/master/karaliste.txt';

const MIN_WORD_LEN = 3; // shared/src/protocol.ts ile ayni
const MIN_PAIR_WORDS = 3; // shared/src/protocol.ts ile ayni

// DIKKAT: shared/src/protocol.ts icindeki normalizeTr ile birebir ayni kalmali.
function normalizeTr(raw) {
  return raw
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u');
}

// shared/src/protocol.ts icindeki pairKey ile ayni (duz JS sort).
function pairKey(a, b) {
  return [a, b].sort().join('');
}

const VALID_WORD = /^[abcçdefgğhıijklmnoöprsştuüvyz]+$/;
// cok parcali maddeler: bosluk, tire, kesme (duz + kivrik), nokta, parantez
const MULTI_TOKEN = /[\s\-'’.()]/;

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`cache hit: ${path.basename(dest)}`);
    return;
  }
  console.log(`indiriliyor: ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`kaydedildi: ${path.basename(dest)} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

// Ana kaynak: tar.gz indir, ac, JSON-lines maddelerini dondur.
async function loadFromGts() {
  const archive = path.join(CACHE_DIR, 'v12.gts.json.tar.gz');
  const jsonPath = path.join(CACHE_DIR, 'gts.json');
  await download(GTS_URL, archive);
  if (!fs.existsSync(jsonPath) || fs.statSync(jsonPath).size === 0) {
    execFileSync('tar', ['-xzf', archive, '-C', CACHE_DIR]);
  }
  if (!fs.existsSync(jsonPath)) {
    // arsiv icindeki ilk .json dosyasini bul
    const alt = fs.readdirSync(CACHE_DIR).find((f) => f.endsWith('.json'));
    if (!alt) throw new Error('arsivde .json bulunamadi');
    fs.renameSync(path.join(CACHE_DIR, alt), jsonPath);
  }
  const lines = fs.readFileSync(jsonPath, 'utf8').split('\n');
  const entries = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try {
      obj = JSON.parse(t);
    } catch {
      continue;
    }
    if (typeof obj.madde !== 'string') continue;
    // ozel_mi "0"/"1" string gelebilir
    entries.push({ madde: obj.madde, ozel: Number(obj.ozel_mi) === 1 });
  }
  return entries;
}

// Yedek kaynak: autocomplete.json (ozel_mi bayragi yok).
async function loadFromFallback() {
  const dest = path.join(CACHE_DIR, 'autocomplete.json');
  await download(FALLBACK_URL, dest);
  const arr = JSON.parse(fs.readFileSync(dest, 'utf8'));
  return arr
    .filter((e) => e && typeof e.madde === 'string')
    .map((e) => {
      const ch = e.madde[0] ?? '';
      // buyuk harfle baslayan = ozel isim varsayimi
      return { madde: e.madde, ozel: ch !== ch.toLocaleLowerCase('tr-TR') };
    });
}

async function buildBadwords() {
  const dest = path.join(CACHE_DIR, 'karaliste.txt');
  await download(BADWORDS_URL, dest);
  const set = new Set();
  for (const line of fs.readFileSync(dest, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || /\s/.test(t)) continue; // tek parca olanlar
    set.add(t.toLocaleLowerCase('tr-TR'));
  }
  const collator = new Intl.Collator('tr');
  return [...set].sort(collator.compare);
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let entries;
  let source = 'gts';
  try {
    entries = await loadFromGts();
  } catch (err) {
    console.warn(`ana kaynak basarisiz (${err.message}), yedege geciliyor`);
    source = 'fallback';
    entries = await loadFromFallback();
  }

  const rawCount = entries.length;
  const words = new Set();
  for (const { madde, ozel } of entries) {
    if (ozel) continue;
    if (MULTI_TOKEN.test(madde)) continue;
    const w = normalizeTr(madde);
    if (w.length < 2) continue;
    if (!VALID_WORD.test(w)) continue;
    words.add(w);
  }

  const collator = new Intl.Collator('tr');
  const sorted = [...words].sort(collator.compare);

  // cift sayaci: sadece MIN_WORD_LEN ve uzeri kelimeler
  const pairs = {};
  let longCount = 0;
  for (const w of sorted) {
    if (w.length < MIN_WORD_LEN) continue;
    longCount++;
    const key = pairKey(w[0], w[w.length - 1]);
    pairs[key] = (pairs[key] ?? 0) + 1;
  }

  const badwords = await buildBadwords();

  fs.writeFileSync(path.join(DATA_DIR, 'words.txt'), sorted.join('\n') + '\n');
  fs.writeFileSync(path.join(DATA_DIR, 'pairs.json'), JSON.stringify(pairs));
  fs.writeFileSync(path.join(DATA_DIR, 'badwords.json'), JSON.stringify(badwords));

  const pairCount = Object.keys(pairs).length;
  const playablePairs = Object.values(pairs).filter((n) => n >= MIN_PAIR_WORDS).length;

  console.log('--- istatistikler ---');
  console.log(`kaynak            : ${source}`);
  console.log(`ham girdi         : ${rawCount}`);
  console.log(`filtreli kelime   : ${sorted.length}`);
  console.log(`>= ${MIN_WORD_LEN} harf         : ${longCount}`);
  console.log(`cift sayisi       : ${pairCount}`);
  console.log(`cift (>= ${MIN_PAIR_WORDS} cozum): ${playablePairs}`);
  console.log(`kufur listesi     : ${badwords.length}`);

  // saglamlik kontrolleri
  const mustHave = ['elma', 'kalem', 'ışık', 'kağıt', 'ak'];
  const mustNotHave = ['ankara', 'istanbul', 'çorum'];
  let failed = false;
  for (const w of mustHave) {
    if (!words.has(w)) {
      console.error(`SANITY FAIL: '${w}' listede yok`);
      failed = true;
    }
  }
  for (const w of mustNotHave) {
    if (words.has(w)) {
      console.error(`SANITY FAIL: '${w}' listede olmamali`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
  console.log('saglamlik kontrolleri gecti');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
