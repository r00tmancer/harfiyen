import { useEffect, useState } from 'react';

// sunucu epoch deadline'ina gore kalan sure; 100ms'de bir tazelenir
export function useRemaining(deadline: number | null): number {
  const [, force] = useState(0);
  useEffect(() => {
    if (deadline === null) return;
    const id = window.setInterval(() => force((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [deadline]);
  return deadline === null ? 0 : Math.max(0, deadline - Date.now());
}

// buyuk harfe cevirme Turkce kurallariyla (i -> Iota degil, dotted I)
export function up(s: string): string {
  return s.toLocaleUpperCase('tr-TR');
}
