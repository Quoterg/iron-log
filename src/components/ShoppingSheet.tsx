import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addDays, changeShopping, entriesBetween, isoDate, listPrices, listShopping, newId, putPrice, type Entry } from '../lib/db';
import { fmt, lang, parseNum, t } from '../lib/i18n';
import { foodName } from '../lib/nutrients';
import { servingsFor } from '../lib/servings';
import {
  addTo, byCost, expand, krPerKg, lineCost, listCost, MAX_SHOP_ITEMS, sectionOf, SECTIONS, shopAmount, toText,
  type FoodPrice, type PriceUnit, type Section, type ShopItem,
} from '../lib/shopping';
import { tsh, type ShopKey } from '../lib/strings-shop';
import { ensureFoods, foods, recipes, settings, supplementRefs, templates, updateSettings, userServings } from '../state';
import { CHAINS, DEFAULT_CHAINS, OFFER_LINES, searchTerm } from '../lib/stores';
import { Sheet } from './Sheet';

const SECTION_LABEL: Record<Section, ShopKey> = {
  produce: 'secProduce', bread: 'secBread', dairy: 'secDairy', meat: 'secMeat', dry: 'secDry', frozen: 'secFrozen', other: 'secOther',
};

const nameOf = (item: ShopItem) => {
  if (item.text) return item.text;
  const f = foods.value.get(item.foodRef!);
  return f ? foodName(f, lang.value) : '…';
};

const unitsOf = (ref?: string) => {
  const f = ref ? foods.value.get(ref) : undefined;
  return f ? servingsFor(f, userServings.value.get(ref!)) : [];
};

function amountOf(item: ShopItem): string {
  if (!item.foodRef || !item.grams) return '';
  const a = shopAmount(item.grams, unitsOf(item.foodRef));
  return `${fmt(a.qty, a.unit === 'l' || a.unit === 'kg' ? 2 : 0)} ${a.unit}`;
}

/** Price units a food's shelf price can be typed in: kg always, l for liquids, st for pieces. */
function priceUnits(ref?: string): PriceUnit[] {
  const u = unitsOf(ref);
  return ['kg', ...(u.some((x) => x.name === 'dl' || x.name === 'glas') ? (['l'] as const) : []), ...(u.some((x) => x.name === 'st') ? (['st'] as const) : [])];
}

/** One line: tick, name, amount, cost; "Pris" opens a small editor (the shelf's comparison price). */
function Line(props: {
  item: ShopItem;
  prices: Map<string, FoodPrice>;
  share?: number;
  /** Offer links for this line (the biggest items; M31). */
  offers?: { name: string; href: string }[];
  onSave: (changed: ShopItem[], removed?: string[]) => void;
  onPrice: (p: FoodPrice) => void;
}) {
  const { item: i, prices } = props;
  const [editing, setEditing] = useState(false);
  const [kr, setKr] = useState('');
  const [unit, setUnit] = useState<PriceUnit>('kg');
  const cost = lineCost(i, prices);
  const name = nameOf(i);

  const savePrice = (e: Event) => {
    e.preventDefault();
    const n = parseNum(kr);
    if (!(n > 0 && n < 1e5)) return;
    if (i.foodRef) {
      const k = krPerKg(n, unit, unitsOf(i.foodRef));
      if (k) props.onPrice({ foodRef: i.foodRef, krPerKg: k, updatedAt: Date.now() });
    } else props.onSave([{ ...i, kr: n, updatedAt: Date.now() }]);
    setEditing(false);
    setKr('');
  };

  return (
    <li class="shop-line">
      <div class="ingredient">
        <label class={i.checked ? 'shop-item done' : 'shop-item'}>
          <input type="checkbox" checked={!!i.checked} onChange={() => props.onSave([{ ...i, checked: !i.checked, updatedAt: Date.now() }])} />
          <span class="entry-name">{name}</span>
          <span class="num muted">
            {amountOf(i)}
            {cost && ` · ${cost.estimated ? '~' : ''}${fmt(cost.kr)} kr`}
            {props.share != null && cost && ` · ${fmt(props.share * 100)} %`}
          </span>
        </label>
        <button type="button" class="btn small" aria-expanded={editing} onClick={() => setEditing(!editing)}>
          {tsh('shopPrice')}
        </button>
        <button type="button" class="btn small" aria-label={`${t('remove')} ${name}`} onClick={() => props.onSave([], [i.id])}>
          ×
        </button>
      </div>
      {props.offers && props.offers.length > 0 && (
        <p class="offer-links small">
          <span class="muted">{tsh('shopOffers')}</span>
          {props.offers.map((o) => (
            <a key={o.name} class="chip" href={o.href} target="_blank" rel="noopener noreferrer">
              {o.name}
            </a>
          ))}
        </p>
      )}
      {editing && (
        <form class="row shop-price" onSubmit={savePrice}>
          <label>
            {i.foodRef ? tsh('shopPriceLabel') : tsh('shopPriceItem')}
            <input type="text" inputMode="decimal" value={kr} onInput={(e) => setKr((e.currentTarget as HTMLInputElement).value)} />
          </label>
          {i.foodRef && (
            <label>
              {t('unit')}
              <select value={unit} onChange={(e) => setUnit((e.currentTarget as HTMLSelectElement).value as PriceUnit)}>
                {priceUnits(i.foodRef).map((u) => (
                  <option key={u} value={u}>
                    kr/{u}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" class="btn" disabled={!(parseNum(kr) > 0)}>
            {tsh('shopSavePrice')}
          </button>
          {i.foodRef && <p class="muted small block">{tsh('shopPriceHint')}</p>}
        </form>
      )}
    </li>
  );
}

/**
 * Shopping list (M28, M30): add what you ate this past week, saved meals, recipes or own items;
 * prices from the shelf give an estimated total and the biggest items first; tick off; share.
 */
export default function ShoppingSheet() {
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [prices, setPrices] = useState<Map<string, FoodPrice>>(new Map());
  const [recent, setRecent] = useState<Entry[]>([]);
  const [planned, setPlanned] = useState<Entry[]>([]);
  const [byCostView, setByCostView] = useState(false);
  const [status, setStatus] = useState('');
  const [own, setOwn] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    const today = isoDate(new Date());
    void Promise.all([listShopping(), listPrices(), entriesBetween(addDays(today, -6), today), entriesBetween(addDays(today, 1), addDays(today, 7))]).then(
      async ([list, p, past, next]) => {
        const food = (e: Entry) => !supplementRefs.value.has(e.foodRef);
        const [r, n] = [past.filter(food), next.filter(food)];
        await ensureFoods([...list.flatMap((i) => (i.foodRef ? [i.foodRef] : [])), ...r.map((e) => e.foodRef), ...n.map((e) => e.foodRef)]);
        if (!live) return;
        setItems(list);
        setPrices(new Map(p.map((x) => [x.foodRef, x])));
        setRecent(r);
        setPlanned(n);
      },
    );
    return () => void (live = false);
  }, []);

  /**
   * Store, then show (on top of the latest list, so quick taps don't overwrite each other). A failed
   * write shows nothing new and says so.
   */
  const save = async (changed: ShopItem[], removed: string[] = []) => {
    try {
      await changeShopping(changed, removed);
    } catch {
      setStatus(tsh('shopSaveFailed'));
      return;
    }
    setItems((cur) => {
      const byId = new Map((cur ?? []).map((i) => [i.id, i]));
      for (const c of changed) byId.set(c.id, c);
      for (const id of removed) byId.delete(id);
      return [...byId.values()];
    });
  };

  /** Remember what a food costs (kr/kg) for every line of it, now and later. */
  const savePrice = async (p: FoodPrice) => {
    try {
      await putPrice(p);
    } catch {
      setStatus(tsh('shopSaveFailed'));
      return;
    }
    setPrices((cur) => new Map(cur).set(p.foodRef, p));
  };

  /** Room for `n` more lines (the list is kept to MAX_SHOP_ITEMS); says so when full. */
  const room = (n: number) => {
    const ok = (items?.length ?? 0) + n <= MAX_SHOP_ITEMS;
    if (!ok) setStatus(tsh('shopFull').replace('{n}', String(MAX_SHOP_ITEMS)));
    return ok;
  };

  /** Add foods (recipes become their ingredients); a double tap on a slow phone adds once. */
  const add = async (list: { foodRef: string; grams: number }[]) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const parts = expand(list, new Map(recipes.value.map((r) => [r.ref, r])));
      await ensureFoods(parts.map((p) => p.foodRef));
      const changed = addTo(items ?? [], parts, Date.now(), newId);
      const fresh = changed.filter((c) => !items?.some((i) => i.id === c.id)).length;
      if (!room(fresh)) return;
      await save(changed);
      setStatus(tsh('shopAdded'));
    } finally {
      busy.current = false;
    }
  };

  // Section and name of each line worked out once per change (not per render and section).
  const groups = useMemo(() => {
    const collator = new Intl.Collator(lang.value);
    const rows = (items ?? []).map((i) => ({ i, name: nameOf(i), section: sectionOf(i.text ?? nameOf(i)) }));
    return SECTIONS.map((section) => ({
      section,
      list: rows
        .filter((r) => r.section === section)
        .sort((a, b) => Number(!!a.i.checked) - Number(!!b.i.checked) || collator.compare(a.name, b.name))
        .map((r) => r.i),
    })).filter((g) => g.list.length);
  }, [items, foods.value, lang.value]);
  const costs = useMemo(() => (items ? listCost(items, prices) : null), [items, prices]);
  const ranked = useMemo(() => (byCostView && items ? byCost(items, prices) : []), [byCostView, items, prices]);

  const share = async () => {
    const text = toText(
      t('shoppingList'),
      groups.map((g) => ({ title: tsh(SECTION_LABEL[g.section]), lines: g.list.filter((i) => !i.checked).map((i) => `${nameOf(i)} ${amountOf(i)}`.trim()) })),
    );
    try {
      if (navigator.share) await navigator.share({ title: t('shoppingList'), text });
      else {
        await navigator.clipboard.writeText(text);
        setStatus(tsh('shopCopied'));
      }
    } catch {
      // Cancelled by the user, or no clipboard access: nothing to do.
    }
  };

  // Offer links (M31): the user's chains, for the most expensive priced lines still to buy.
  const chosen = settings.value.chains ?? DEFAULT_CHAINS;
  const chains = CHAINS.filter((c) => chosen.includes(c.id));
  const offerIds = new Set(ranked.filter((r) => r.kr != null && !r.item.checked).slice(0, OFFER_LINES).map((r) => r.item.id));
  const offersFor = (i: ShopItem) => {
    if (!offerIds.has(i.id)) return undefined;
    const term = searchTerm(nameOf(i), !!i.text);
    return chains.map((c) => ({ name: c.name, href: c.url(term) }));
  };
  const toggleChain = (id: string) =>
    void updateSettings({ chains: chosen.includes(id) ? chosen.filter((x) => x !== id) : CHAINS.map((c) => c.id).filter((x) => x === id || chosen.includes(x)) });

  const line = (i: ShopItem, share?: number) => (
    <Line key={i.id} item={i} prices={prices} share={share} offers={offersFor(i)} onSave={(c, r) => void save(c, r)} onPrice={(p) => void savePrice(p)} />
  );
  const liveTemplates = templates.value;
  const liveRecipes = recipes.value.filter((r) => !r.deleted);

  return (
    <Sheet title={t('shoppingList')}>
      <div class="pad shopping">
        {!items ? (
          <p class="muted">{t('loading')}</p>
        ) : items.length === 0 ? (
          <p class="muted">{tsh('shopEmpty')}</p>
        ) : (
          <>
            <div class="chips" role="group" aria-label={tsh('shopView')}>
              <button type="button" class={byCostView ? 'chip' : 'chip on'} aria-pressed={!byCostView} onClick={() => setByCostView(false)}>
                {tsh('shopViewSections')}
              </button>
              <button type="button" class={byCostView ? 'chip on' : 'chip'} aria-pressed={byCostView} onClick={() => setByCostView(true)}>
                {tsh('shopViewCost')}
              </button>
            </div>
            {costs && costs.total > 0 && (
              <p class="shop-total">
                <span class="num">{tsh('shopTotal').replace('{kr}', fmt(costs.total))}</span>
                {costs.missing > 0 && <span class="muted small"> · {tsh('shopNoPrice').replace('{n}', String(costs.missing))}</span>}
              </p>
            )}
            {byCostView ? (
              <section class="card">
                <ul class="entries">{ranked.map((r) => line(r.item, r.share))}</ul>
                <p class="muted small">{tsh('shopCostNote')}</p>
                <h3 class="suggest-sub">{tsh('shopMyStores')}</h3>
                <div class="chips">
                  {CHAINS.map((c) => (
                    <button key={c.id} type="button" class={chosen.includes(c.id) ? 'chip on' : 'chip'} aria-pressed={chosen.includes(c.id)} onClick={() => toggleChain(c.id)}>
                      {c.name}
                    </button>
                  ))}
                </div>
                <p class="muted small">{tsh('shopOffersNote')}</p>
              </section>
            ) : (
              groups.map((g) => (
                <section class="card" key={g.section}>
                  <h2>{tsh(SECTION_LABEL[g.section])}</h2>
                  <ul class="entries">{g.list.map((i) => line(i))}</ul>
                </section>
              ))
            )}
            <div class="actions">
              <button type="button" class="btn primary" onClick={() => void share()}>
                {tsh('shopShare')}
              </button>
            </div>
            <div class="links">
              <button type="button" class="link" onClick={() => void save([], items.filter((i) => i.checked).map((i) => i.id))}>
                {tsh('shopClearChecked')}
              </button>
              <button type="button" class="link" onClick={() => confirm(tsh('shopClearAllConfirm')) && void save([], items.map((i) => i.id))}>
                {tsh('shopClearAll')}
              </button>
            </div>
          </>
        )}
        {status && (
          <p class="small" role="status">
            {status}
          </p>
        )}

        <section class="card form">
          <h2>{tsh('shopAddTitle')}</h2>
          {/* What was eaten this past week: the usual way to restock. */}
          <h3 class="suggest-sub">{tsh('shopLastWeek')}</h3>
          {recent.length ? (
            <button type="button" class="btn wide" onClick={() => void add(recent.map((e) => ({ foodRef: e.foodRef, grams: e.grams })))}>
              + {tsh('shopPlannedCount').replace('{n}', String(new Set(recent.map((e) => e.foodRef)).size))}
            </button>
          ) : (
            <p class="muted small">{tsh('shopNoLastWeek')}</p>
          )}
          {planned.length > 0 && (
            <>
              <h3 class="suggest-sub">{tsh('shopPlanned')}</h3>
              <button type="button" class="btn wide" onClick={() => void add(planned.map((e) => ({ foodRef: e.foodRef, grams: e.grams })))}>
                + {tsh('shopPlannedCount').replace('{n}', String(new Set(planned.map((e) => e.foodRef)).size))}
              </button>
            </>
          )}

          <form
            class="row"
            onSubmit={(e) => {
              e.preventDefault();
              const text = own.trim();
              if (!text || !room(1)) return;
              void save([{ id: newId(), text: text.slice(0, 200), updatedAt: Date.now() }]);
              setOwn('');
            }}
          >
            <label>
              {tsh('shopOwnItem')}
              <input type="text" value={own} maxLength={200} placeholder={tsh('shopOwnPlaceholder')} onInput={(e) => setOwn((e.currentTarget as HTMLInputElement).value)} />
            </label>
            <button type="submit" class="btn" disabled={!own.trim()}>
              {tsh('shopAdd')}
            </button>
          </form>

          {liveTemplates.length > 0 && <h3 class="suggest-sub">{tsh('shopSavedMeals')}</h3>}
          <ul class="entries">
            {liveTemplates.map((m) => (
              <li key={m.id} class="ingredient">
                <span class="entry entry-static">
                  <span class="entry-name">{m.name}</span>
                </span>
                <button type="button" class="btn small" aria-label={`${tsh('shopAdd')}: ${m.name}`} onClick={() => void add(m.items)}>
                  +
                </button>
              </li>
            ))}
          </ul>

          {liveRecipes.length > 0 && <h3 class="suggest-sub">{tsh('shopRecipes')}</h3>}
          <ul class="entries">
            {liveRecipes.map((r) => (
              <li key={r.ref} class="ingredient">
                <span class="entry entry-static">
                  <span class="entry-name">{r.name}</span>
                </span>
                <button type="button" class="btn small" aria-label={`${tsh('shopAdd')}: ${r.name}`} onClick={() => void add(r.ingredients.map((i) => ({ foodRef: i.foodRef, grams: i.grams })))}>
                  +
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Sheet>
  );
}
