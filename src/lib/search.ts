// Food search: small, allocation-light and fast enough to run on every keystroke
// over ~10k foods on a low-end phone (runs inside a Web Worker).

/** Lowercase and fold diacritics so "ost" finds "Öst" and "creme" finds "crème".
 * å/ä/ö are folded too — users on non-Swedish keyboards type "o" for "ö". */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

export interface SearchEntry {
  /** Index into the caller's food array. */
  i: number;
  /** Normalised words of all names of this food. */
  words: string[];
  /** Normalised primary name (in the user's language). */
  name: string;
}

export function buildEntry(i: number, names: (string | null)[], primary: string): SearchEntry {
  const words = new Set<string>();
  for (const n of names) if (n) for (const w of normalize(n).split(' ')) if (w) words.add(w);
  return { i, words: [...words], name: normalize(primary) };
}

/** Returns indices of matching foods, best first. Every query token must
 * prefix-match some word of the food's names. */
export function search(entries: SearchEntry[], query: string, limit = 50): number[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];
  const first = tokens[0];
  const hits: { i: number; score: number }[] = [];

  outer: for (const e of entries) {
    let score = 0;
    for (const t of tokens) {
      const best = matchToken(e.words, t);
      if (best === 0) continue outer;
      score += best;
    }
    // Prefer foods whose (localised) name starts with the query, and short, generic names:
    // "Mjölk" before "Mjölkchoklad med hasselnötter".
    if (e.name.startsWith(first)) score += 4;
    if (e.name === tokens.join(' ')) score += 4;
    score -= e.name.length / 40;
    hits.push({ i: e.i, score });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map((h) => h.i);
}

const MIN_PART = 3;

/** 3 = exact word, 2 = word prefix, 1 = part of a Swedish compound, 0 = no match.
 * Compounds work both ways: "filé" finds "bröstfilé", and "kycklingfilé" finds
 * "Kyckling bröstfilé" by splitting the query into "kyckling" + "filé". */
function matchToken(words: string[], t: string): number {
  let best = 0;
  for (const w of words) {
    if (w === t) return 3;
    if (w.startsWith(t)) best = 2;
    else if (best === 0 && t.length >= MIN_PART && w.includes(t)) best = 1;
  }
  if (best > 0 || t.length < MIN_PART * 2) return best;
  for (let k = MIN_PART; k <= t.length - MIN_PART; k++) {
    const head = t.slice(0, k);
    const tail = t.slice(k);
    if (words.some((w) => w.startsWith(head)) && words.some((w) => w.includes(tail))) return 1;
  }
  return 0;
}
