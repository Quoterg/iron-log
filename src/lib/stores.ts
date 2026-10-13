// Offer links (M31): one tap opens a store's own search for a shopping-list item. The app fetches
// nothing — the link opens the store's site in the browser. Loaded with the shopping sheet.
// URL patterns checked 2026-10-13 (each answers 200 with the query); ICA's search needs a chosen
// store, so ICA opens its offers page.

export interface Chain {
  id: string;
  name: string;
  /** Link for a search term; `term` is ignored where the store has no item search link. */
  url: (term: string) => string;
}

const q = encodeURIComponent;

export const CHAINS: Chain[] = [
  { id: 'willys', name: 'Willys', url: (t) => `https://www.willys.se/sok?q=${q(t)}` },
  { id: 'ica', name: 'ICA', url: () => 'https://www.ica.se/erbjudanden/' },
  { id: 'coop', name: 'Coop', url: (t) => `https://www.coop.se/handla/sok/?q=${q(t)}` },
  { id: 'lidl', name: 'Lidl', url: (t) => `https://www.lidl.se/q/search?q=${q(t)}` },
  { id: 'hemkop', name: 'Hemköp', url: (t) => `https://www.hemkop.se/sok?q=${q(t)}` },
  { id: 'citygross', name: 'City Gross', url: (t) => `https://www.citygross.se/sok?Q=${q(t)}` },
];

export const DEFAULT_CHAINS = ['willys', 'ica', 'coop', 'lidl'];
export const CHAIN_IDS = CHAINS.map((c) => c.id);

/**
 * What to search for: the name's first word, which store searches match best ("Mjölk fett 3%
 * berikad" → "Mjölk", "Chicken, breast, raw" → "Chicken"). Own items keep their text.
 */
export function searchTerm(name: string, own = false): string {
  if (own) return name.trim().slice(0, 60);
  return name.split(/[\s,(]/)[0].replace(/[^\p{L}\p{N}-]/gu, '') || name.trim().slice(0, 60);
}

/** Lines that get offer links: the most expensive priced ones (at most `n`). */
export const OFFER_LINES = 5;
