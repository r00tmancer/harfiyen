// Dokunsal geri bildirim — Android'de calisir; iOS Safari'de navigator.vibrate
// hic yoktur, sessizce no-op'a duser. Tercih localStorage'da tutulur.

const KEY = 'harfiyen:haptics';

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

// varsayilan acik; sadece '0' yazilmissa kapali
export function hapticsEnabled(): boolean {
  return localStorage.getItem(KEY) !== '0';
}

export function setHapticsEnabled(on: boolean): void {
  localStorage.setItem(KEY, on ? '1' : '0');
}

function buzz(pattern: number | number[]): void {
  if (!hapticsSupported() || !hapticsEnabled()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // izin/politika engeli: sessiz gec
  }
}

// olay basina desenler
export const haptics = {
  accept: () => buzz([30, 50, 120]), // kabul edilen kelime / telepati uyumu
  error: () => buzz(60), // red / hata
  tick: () => buzz(15), // geri sayim tiki
  boom: () => buzz([80, 40, 80]), // bomba patlamasi
  victory: () => buzz([30, 50, 30, 50, 150]), // mac sonu
  reaction: () => buzz(20), // rakipten tepki geldi
};
