// The search index in two parts (M70, first called M54), out of the worker so it can be tested in
// Node: the databases' foods, built once per language and kept when the user's own foods change (a
// custom food, a scan, a recipe, a quick entry, a sync), and the user's own, small and rebuilt then.
// Before, any change re-indexed all ~10 600 foods.
import type { Food } from './nutrients';
import { buildEntry, search, Vocab, type SearchEntry } from './search';

/** The user's own foods rank slightly above database foods with the same match. */
export const CUSTOM_BOOST = 1;
/** Everyday foods (data/popular.txt): "ris" → cooked rice before raw specialty rice. */
export const POPULAR_BOOST = 2;

export class FoodIndex {
  private builtIn: Food[] = [];
  private custom: Food[] = [];
  /** builtIn then custom: an entry's `i` points here. */
  private all: Food[] = [];
  private builtInIndex: Partial<Record<string, SearchEntry[]>> = {};
  private customIndex: Partial<Record<string, SearchEntry[]>> = {};
  private index: Partial<Record<string, SearchEntry[]>> = {};
  /** Refs of everyday foods. */
  readonly popular = new Set<string>();
  /** Per-food boost from the user's own history (count, favourites), set by the main thread. */
  private userBoost: Record<string, number> = {};

  /** The enabled databases' foods changed (a source loaded or switched): both parts are rebuilt. */
  setBuiltIn(foods: Food[]): void {
    this.builtIn = foods;
    this.builtInIndex = {};
    this.setCustom(this.custom);
  }

  /** Only the user's own foods changed: the databases' index stays. */
  setCustom(foods: Food[]): void {
    this.custom = foods;
    this.all = this.builtIn.concat(foods);
    this.customIndex = {};
    this.index = {};
  }

  /** New boosts, updated in place: cheaper than rebuilding the index after every logged food. */
  setBoosts(boosts: Record<string, number>): void {
    this.userBoost = boosts;
    // Both parts, by which part they are in: the databases' one is kept while the combined one may
    // not be built yet.
    for (const part of Object.values(this.builtInIndex)) for (const e of part ?? []) e.boost = this.boostFor(this.all[e.i].ref, false);
    for (const part of Object.values(this.customIndex)) for (const e of part ?? []) e.boost = this.boostFor(this.all[e.i].ref, true);
  }

  /** The index for a language, built on first use. */
  indexFor(lang: string): SearchEntry[] {
    return (this.index[lang] ??= (this.builtInIndex[lang] ??= this.entries(this.builtIn, 0, lang, false)).concat(
      (this.customIndex[lang] ??= this.entries(this.custom, this.builtIn.length, lang, true)),
    ));
  }

  search(query: string, lang: string, limit: number): Food[] {
    return search(this.indexFor(lang), query, limit).map((i) => this.all[i]);
  }

  /**
   * Index entries for a part of `all` starting at `offset`, with its own vocabulary. Whether the
   * part is the user's own is said, not derived from `offset` (review #97: with no database loaded
   * the user's part starts at 0, and its foods lost their boost).
   */
  private entries(foods: Food[], offset: number, lang: string, isCustom: boolean): SearchEntry[] {
    const vocab = new Vocab();
    return foods.map((f, k) => {
      const e = buildEntry(offset + k, [f.sv, f.en, f.terms ?? null], lang === 'en' ? (f.en ?? f.sv) : f.sv, vocab);
      e.boost = this.boostFor(f.ref, isCustom);
      return e;
    });
  }

  private boostFor(ref: string, isCustom: boolean): number {
    return (isCustom ? CUSTOM_BOOST : 0) + (this.popular.has(ref) ? POPULAR_BOOST : 0) + (this.userBoost[ref] ?? 0);
  }

  /** For tests: whether a language's databases index has been built (and kept). */
  hasBuiltInIndex(lang: string): boolean {
    return !!this.builtInIndex[lang];
  }
}
