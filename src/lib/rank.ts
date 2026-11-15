// Search ranking (M62): plain staples first, the user's own history first, eko twins not crowding
// the top. Pure, on normalised names (lib/search.ts `normalize`); used by `search()` in the worker.

/** A food the user has logged before ranks above any food they haven't, among the matches. */
export const LOGGED_BOOST = 10;

/**
 * The boost from the user's history: logged at all (LOGGED_BOOST), more for often (≤ 3), favourite
 * (+2). Bigger than any difference in how well two foods match, so "foods logged before rank first".
 */
export function usageBoost(count: number, fav?: boolean): number {
  return (count > 0 ? LOGGED_BOOST + Math.min(3, 0.75 * Math.log2(1 + count)) : 0) + (fav ? 2 : 0);
}

/**
 * Shorter query words are never taken as a compound's head: three letters end too many unrelated
 * words ("pizzapålägg" ends with "ägg", "pris" with "ris").
 */
const MIN_HEAD = 4;

/**
 * How well a food's name fits the query's first word, by its first word. Swedish puts the kind last
 * in a compound: "lättmjölk" is a milk, "mjölkchoklad" is chocolate. So:
 * - the first word is the query word ("Mjölk fett 3%"): +4;
 * - it ends with it, a compound naming that kind ("Lättmjölk", "Mellanmjölk"): +3;
 * - it only starts with it ("Mjölkchoklad", "Mjölkpulver"): +1 when the query is a whole word in
 *   the data (the user typed "mjölk" and means milk), +4 while it isn't (still typing: "mjö").
 */
export function nameBonus(name: string, token: string, tokenIsWord: boolean): number {
  const space = name.indexOf(' ');
  const firstWord = space < 0 ? name : name.slice(0, space);
  if (firstWord === token) return 4;
  if (token.length >= MIN_HEAD && firstWord.endsWith(token)) return 3;
  if (firstWord.startsWith(token)) return tokenIsWord ? 1 : 4;
  return 0;
}

/** Organic markers in normalised names ("Ägg rått eko." → "agg ratt eko"). */
const ECO = /(^| )(eko|ekol|ekologisk|ekologiska|krav)(?= |$)/g;

/** A name without its organic marker: the key eko and non-eko twins share. */
export function variantKey(name: string): string {
  return name.replace(ECO, ' ').replace(/ +/g, ' ').trim();
}

export const isEco = (name: string): boolean => variantKey(name) !== name.replace(/ +/g, ' ').trim();

/** How far an eko twin drops below the plain food it duplicates. */
export const TWIN_PENALTY = 5;

/**
 * Per name, a penalty for an eko variant whose plain twin is among the same results ("Ägg kokt eko."
 * next to "Ägg kokt"): the twins stay findable, just not three of the first six. A lone eko food
 * (no plain twin in the results) keeps its place.
 */
export function twinPenalties(names: string[]): number[] {
  const plain = new Set(names.filter((n) => !isEco(n)).map(variantKey));
  return names.map((n) => (isEco(n) && plain.has(variantKey(n)) ? TWIN_PENALTY : 0));
}
