// Shopping list (M28): what to buy for saved meals, recipes and planned days, summed per food,
// rounded to shop-friendly amounts and grouped by store section. Pure helpers; the sheet
// (components/ShoppingSheet.tsx) loads and saves. Loaded on demand.
import type { Serving } from './nutrients';
import type { StoredRecipe } from './recipes';

export interface ShopItem {
  id: string;
  /** A food to buy (amount in grams), or… */
  foodRef?: string;
  grams?: number;
  /** …a free-text item ("tandkräm"). */
  text?: string;
  checked?: boolean;
  updatedAt: number;
}

export const MAX_SHOP_ITEMS = 300;

/**
 * Foods with amounts; recipes are replaced by their ingredients, scaled to the amount used. One level
 * is enough: a recipe can't contain a recipe (the ingredient search excludes them).
 */
export function expand(items: { foodRef: string; grams: number }[], recipes: Map<string, StoredRecipe>): { foodRef: string; grams: number }[] {
  return items.flatMap((i) => {
    const r = i.foodRef.startsWith('recipe:') ? recipes.get(i.foodRef) : undefined;
    if (!r || !(r.totalG > 0)) return [i];
    const share = i.grams / r.totalG;
    return r.ingredients.map((ing) => ({ foodRef: ing.foodRef, grams: ing.grams * share }));
  });
}

/**
 * Add foods to the list: summed into the not-yet-ticked item of the same food, else new items.
 * Returns the items to save (changed or new).
 */
export function addTo(list: ShopItem[], add: { foodRef: string; grams: number }[], now: number, newId: () => string): ShopItem[] {
  const open = new Map(list.filter((x) => x.foodRef && !x.checked).map((x) => [x.foodRef!, { ...x }]));
  const changed = new Map<string, ShopItem>();
  for (const a of add) {
    if (!(a.grams > 0)) continue;
    const cur = open.get(a.foodRef) ?? { id: newId(), foodRef: a.foodRef, grams: 0, updatedAt: now };
    cur.grams = Math.round(((cur.grams ?? 0) + a.grams) * 10) / 10;
    cur.updatedAt = now;
    open.set(a.foodRef, cur);
    changed.set(cur.id, cur);
  }
  return [...changed.values()];
}

export type Section = 'produce' | 'dairy' | 'meat' | 'bread' | 'dry' | 'frozen' | 'other';
export const SECTIONS: Section[] = ['produce', 'bread', 'dairy', 'meat', 'dry', 'frozen', 'other'];

// By name, Swedish and English (the databases' names). First match wins: frozen before the rest,
// meat before dry ("Nötfärs" vs. "Nötter").
const RULES: [Section, RegExp][] = [
  ['frozen', /frysvara|fryst|frozen/i],
  // Nut butters and cooking coconut milk are pantry goods, not dairy ("…smör", "…mjölk", "butter").
  ['dry', /jordnötssmör|nötsmör|mandelsmör|kokosmjölk|peanut butter|nut butter|almond butter|coconut milk/i],
  ['meat', /kött|nöt(kött|färs|stek)|fläsk|gris|kyckling|kalkon|lamm|korv|skinka|bacon|färs|fisk|lax|torsk|sill|räk|tonfisk|makrill|beef|pork|chicken|turkey|lamb|sausage|\bham\b|fish|salmon|cod\b|tuna|shrimp/i],
  ['dairy', /mjölk|yoghurt|(^|\s)ost|ost(\s|,|$)|smör(?!gås)|grädde|kvarg|keso|kesella|skyr|fil(mjölk)?\b|ägg|milk|yogh?urt|cheese|butter|cream|\beggs?\b/i],
  ['produce', /frukt|grönsak|äpple|päron|banan|apelsin|citron|lime|bär|jordgubb|hallon|blåbär|tomat|gurka|sallad|morot|lök|potatis|paprika|broccoli|kål|spenat|svamp|avokado|druv|melon|kiwi|vitlök|apple|pear|banana|orange|lemon|berr|tomato|cucumber|lettuce|carrot|onion|potato|pepper|cabbage|spinach|mushroom|avocado|grape/i],
  ['bread', /bröd|knäcke|havre|gryn|flingor|müsli|(^|\s)ris\b|pasta|spaghetti|spagetti|makaron|mjöl|bulgur|couscous|quinoa|tortilla|bread|\boats?\b|\brice\b|flour|cereal/i],
  ['dry', /bön|lins|kikärt|nötter|mandel|frö|socker|olja|vinäger|krydd|salt\b|honung|sylt|kaffe|kakao|bean|lentil|chickpea|\bnuts?\b|almond|seed|sugar|\boil\b|vinegar|spice|honey|jam\b|coffee|cocoa/i],
];

export function sectionOf(name: string): Section {
  return RULES.find(([, re]) => re.test(name))?.[0] ?? 'other';
}

/**
 * A shop-friendly amount: whole pieces if the food has "st"; litres/decilitres for liquids (a "dl" or
 * "glas" (2 dl) measure weighing 95–115 g per dl, like milk, juice or yoghurt — not oats, flour or
 * sugar, which are bought by weight); else rounded grams.
 */
export function shopAmount(grams: number, units: Serving[] = []): { qty: number; unit: 'st' | 'l' | 'dl' | 'g' | 'kg' } {
  const st = units.find((u) => u.name === 'st');
  if (st && st.g > 0) return { qty: Math.max(1, Math.ceil(grams / st.g - 0.05)), unit: 'st' };
  const dl = units.find((u) => u.name === 'dl')?.g ?? (units.find((u) => u.name === 'glas')?.g ?? 0) / 2;
  if (dl >= 95 && dl <= 115) {
    const dls = grams / dl;
    return dls >= 10 ? { qty: Math.ceil(dls / 2.5) / 4, unit: 'l' } : { qty: Math.ceil(dls - 0.05), unit: 'dl' };
  }
  if (grams >= 1000) return { qty: Math.ceil(grams / 100) / 10, unit: 'kg' };
  return { qty: grams < 100 ? Math.ceil(grams / 10) * 10 : Math.ceil(grams / 50) * 50, unit: 'g' };
}

/** The list as plain text for sharing: one section per heading, ticked items left out. */
export function toText(title: string, groups: { title: string; lines: string[] }[]): string {
  return [title, ...groups.filter((g) => g.lines.length).map((g) => `\n${g.title}\n${g.lines.map((l) => `- ${l}`).join('\n')}`)].join('\n');
}
