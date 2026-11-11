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

/**
 * The distinct words of a set of foods (M54): a query is matched against each word once, not once
 * per food — ~5 000 words instead of ~86 000 word slots in 10 600 foods. Grows as entries are added.
 */
export class Vocab {
  readonly words: string[] = [];
  private readonly ids = new Map<string, number>();
  id(w: string): number {
    let i = this.ids.get(w);
    if (i === undefined) {
      i = this.words.length;
      this.words.push(w);
      this.ids.set(w, i);
    }
    return i;
  }
}

/** For callers that don't keep their own (tests, one-off lists). */
const shared = new Vocab();

export interface SearchEntry {
  /** Index into the caller's food array. */
  i: number;
  /** Ids (in `vocab`) of the normalised words of all names of this food. */
  ids: number[];
  vocab: Vocab;
  /** Normalised primary name (in the user's language). */
  name: string;
  /** Extra score, e.g. for the user's own foods. */
  boost?: number;
}

export function buildEntry(i: number, names: (string | null)[], primary: string, vocab = shared): SearchEntry {
  const ids = new Set<number>();
  for (const n of names) if (n) for (const w of normalize(n).split(' ')) if (w) ids.add(vocab.id(w));
  return { i, ids: [...ids], vocab, name: normalize(primary) };
}

const MIN_PART = 3;

/**
 * One query word against a vocabulary: per word 3 = exact, 2 = prefix, 1 = part of it (a Swedish
 * compound: "filé" finds "bröstfilé"), 0 = none. And, for long words without such a match, the
 * compound split the other way round: "kycklingfilé" finds "Kyckling bröstfilé" when some word of
 * a food starts with "kyckling" and some word contains "filé". Computed once per word, not per food.
 */
class TokenMatch {
  private readonly score: Uint8Array;
  /** Per word: bit k set when the word starts with the query's k-th head / contains its k-th tail. */
  private heads?: Uint32Array;
  private tails?: Uint32Array;

  constructor(
    private readonly vocab: Vocab,
    private readonly t: string,
  ) {
    const words = vocab.words;
    this.score = new Uint8Array(words.length);
    for (let w = 0; w < words.length; w++) {
      const x = words[w];
      this.score[w] = x === t ? 3 : x.startsWith(t) ? 2 : t.length >= MIN_PART && x.includes(t) ? 1 : 0;
    }
  }

  /** The best match among a food's words (the same scores as before M54). */
  of(ids: number[]): number {
    let best = 0;
    for (const id of ids) {
      const s = this.score[id];
      if (s > best) best = s;
      if (best === 3) return 3;
    }
    if (best > 0 || this.t.length < MIN_PART * 2) return best;
    const { heads, tails } = this.splits();
    // Some split whose head starts a word and whose tail is inside a word (not necessarily the same).
    let h = 0;
    let tl = 0;
    for (const id of ids) {
      h |= heads[id];
      tl |= tails[id];
    }
    return h & tl ? 1 : 0;
  }

  /** Every split of the query into a head and a tail, as bits per word; once per query word. */
  private splits(): { heads: Uint32Array; tails: Uint32Array } {
    if (!this.heads || !this.tails) {
      const words = this.vocab.words;
      this.heads = new Uint32Array(words.length);
      this.tails = new Uint32Array(words.length);
      // 32 splits: words up to 37 letters (longer ones only try their first 32 splits).
      const last = Math.min(this.t.length - MIN_PART, MIN_PART + 31);
      for (let k = MIN_PART; k <= last; k++) {
        const bit = 1 << (k - MIN_PART);
        const head = this.t.slice(0, k);
        const tail = this.t.slice(k);
        for (let w = 0; w < words.length; w++) {
          if (words[w].startsWith(head)) this.heads[w] |= bit;
          if (words[w].includes(tail)) this.tails[w] |= bit;
        }
      }
    }
    return { heads: this.heads, tails: this.tails };
  }
}

/** Returns indices of matching foods, best first. Every query token must
 * match some word of the food's names. */
export function search(entries: SearchEntry[], query: string, limit = 50): number[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];
  const first = tokens[0];
  const whole = tokens.join(' ');
  // Built per vocabulary on first use (the databases', the user's own foods').
  const matchers = new Map<Vocab, TokenMatch[]>();
  const hits: { i: number; score: number }[] = [];

  outer: for (const e of entries) {
    let m = matchers.get(e.vocab);
    if (!m) matchers.set(e.vocab, (m = tokens.map((t) => new TokenMatch(e.vocab, t))));
    let score = 0;
    for (const tm of m) {
      const best = tm.of(e.ids);
      if (best === 0) continue outer;
      score += best;
    }
    // Prefer foods whose (localised) name starts with the query, and short, generic names:
    // "Mjölk" before "Mjölkchoklad med hasselnötter".
    if (e.name.startsWith(first)) score += 4;
    if (e.name === whole) score += 4;
    score -= e.name.length / 40;
    score += e.boost ?? 0;
    hits.push({ i: e.i, score });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map((h) => h.i);
}
