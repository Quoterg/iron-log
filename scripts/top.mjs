// Top-k by one value without sorting everything: one pass, a small list kept in descending order.
// Used at build time (build-top.mjs) and unit-tested (src/lib/top.test.ts).

/**
 * The `n` items with the largest `value(item)` (> 0), largest first. Ties keep input order.
 * @template T
 * @param {Iterable<T>} items
 * @param {(item: T) => number | null | undefined} value
 * @param {number} n
 * @returns {T[]}
 */
export function topK(items, value, n) {
  /** @type {{ item: T, x: number }[]} */
  const top = [];
  for (const item of items) {
    const x = value(item) ?? 0;
    if (!(x > 0) || (top.length === n && x <= top[n - 1].x)) continue;
    let j = top.length;
    while (j > 0 && top[j - 1].x < x) j--;
    top.splice(j, 0, { item, x });
    if (top.length > n) top.pop();
  }
  return top.map((t) => t.item);
}
