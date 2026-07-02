import type { ComponentType } from 'react';
import type { SVGProps } from 'react';
import type { GameMode } from '@harfiyen/shared';
import { IconBomb, IconBurst, IconRuler, IconTarget, IconTilesDuo } from './icons';

// mod tanitim metinleri + ikonlari (lobi karti, oyun basligi, zafer ekrani)
export const MODE_ORDER: GameMode[] = ['harf', 'sayi', 'zincir', 'uzun', 'bom'];

export interface ModeMeta {
  name: string;
  desc: string;
  joker: string;
  Icon: ComponentType<{ size?: number } & SVGProps<SVGSVGElement>>;
}

export const MODE_META: Record<GameMode, ModeMeta> = {
  harf: {
    name: 'Harf Yarışı',
    desc: 'İki harfe uyan kelimeleri rakipten önce yaz.',
    joker: 'Joker: Buz — rakibi 5 sn dondur',
    Icon: IconTilesDuo,
  },
  sayi: {
    name: 'Sayı Avı',
    desc: 'Rakibin 1-100 arası gizli sayısını önce bul.',
    joker: 'Joker: Termometre — mesafe ipucu',
    Icon: IconTarget,
  },
  zincir: {
    name: 'Kelime Zinciri',
    desc: 'Son harften kelime türet, bomba sende patlamasın.',
    joker: 'Joker: Pas — sırayı rakibe devret',
    Icon: IconBomb,
  },
  uzun: {
    name: 'En Uzun Kelime',
    desc: 'Tek hakla en uzun kelimeyi yazan raundu alır.',
    joker: 'Joker: Çifte Şans — ikinci hak',
    Icon: IconRuler,
  },
  bom: {
    name: 'Bom',
    desc: "Sırayla say: 7'nin katı ve içinde 7 olan sayıda BOM de!",
    joker: 'Joker: Sigorta — bir hatayı affeder',
    Icon: IconBurst,
  },
};
