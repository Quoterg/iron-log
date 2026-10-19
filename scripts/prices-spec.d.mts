export interface PriceItem {
  key: string;
  q: string | string[];
  re?: RegExp;
  not?: RegExp;
  pieceG?: number;
  density?: number;
  scb: string;
  com?: string[];
  slv?: RegExp;
  raw?: boolean;
  factors?: [RegExp, number][];
  off?: string[];
}
export const ITEMS: PriceItem[];
export const SUM_GROUPS: Set<string>;
export const INDUSTRIAL: RegExp;
export const FREE: Set<string>;
