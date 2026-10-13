import { Component } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addDays, changeShopping, deletePrice, entriesBetween, isoDate, listPrices, listShopping, newId, putPrice, type Entry } from '../lib/db';
import { decimalComma, fmt, lang, parseNum, t } from '../lib/i18n';
import { foodName, type Serving } from '../lib/nutrients';
import { servingsFor } from '../lib/servings';
import {
  addTo, costList, expand, gramsPerDl, krPerKg, MAX_PRICE, MAX_SHOP_ITEMS, sectionOf, SECTIONS, shopAmount, toText,
  type LineCost,
  type Costed, type FoodPrice, type PriceUnit, type Section, type ShopItem,
} from '../lib/shopping';
import { tsh, type ShopKey } from '../lib/strings-shop';
import { ensureFoods, foods, recipes, settings, supplementRefs, templates, updateSettings, userServings } from '../state';
import { CHAINS, DEFAULT_CHAINS, OFFER_LINES, searchTerm } from '../lib/stores';
import { Sheet } from './Sheet';
import { typicalPrices } from '../lib/typical-prices';

const SECTION_LABEL: Record<Section, ShopKey> = {
  produce: 'secProduce', bread: 'secBread', dairy: 'secDairy', meat: 'secMeat', dry: 'secDry', frozen: 'secFrozen', other: 'secOther',
};

const nameOf = (item: ShopItem) => {
  if (item.text) return item.text;
  const f = foods.value.get(item.foodRef!);
  return f ? foodName(f, lang.value) : '…';
};

const unitsOf = (ref?: string): Serving[] => {
  const f = ref ? foods.value.get(ref) : undefined;
  return f ? servingsFor(f, userServings.value.get(ref!)) : [];
};

function amountOf(item: ShopItem, units: Serving[]): string {
  if (!item.foodRef || !item.grams) return '';
  const a = shopAmount(item.grams, units);
  return `${fmt(a.qty, a.unit === 'l' || a.unit === 'kg' ? 2 : 0)} ${a.unit}`;
}

/** Price units a food's shelf price can be typed in: kg always, l for liquids, st for pieces. */
function priceUnits(units: Serving[]): PriceUnit[] {
  return ['kg', ...(gramsPerDl(units) ? (['l'] as const) : []), ...(units.some((x) => x.name === 'st') ? (['st'] as const) : [])];
}

const numText = (n: number) => String(Math.round(n * 100) / 100).replace('.', decimalComma() ? ',' : '.');

interface LineProps {
  item: ShopItem;
  name: string;
  units: Serving[];
  cost: LineCost | null;
  /** The food's remembered price (kr/kg), shown in the editor. */
  price?: FoodPrice;
  /** Its typical price (kr/kg, M33), when food costs are on: shown in the editor as a hint. */
  typical?: number;
  share?: number;
  /** Offer links for this line (the biggest items; M31). */
  offers?: { name: string; href: string }[];
  onSave: (changed: ShopItem[], removed?: string[]) => void;
  onPrice: (p: FoodPrice) => void;
  onClearPrice: (foodRef: string) => void;
}

/** One line: tick, name, amount, cost; "Pris" opens a small editor (the shelf's comparison price). */
function Line(props: LineProps) {
  const { item: i, name, units, cost } = props;
  const [editing, setEditing] = useState(false);
  const [kr, setKr] = useState('');
  const [unit, setUnit] = useState<PriceUnit>('kg');

  // Opens with what is stored (a food's price as kr/kg; an own item's price), so it can be checked.
  const open = () => {
    if (!editing) {
      setKr(i.foodRef ? (props.price ? numText(props.price.krPerKg) : '') : i.kr != null ? numText(i.kr) : '');
      setUnit('kg');
    }
    setEditing(!editing);
  };
  const savePrice = (e: Event) => {
    e.preventDefault();
    const n = parseNum(kr);
    if (!(n > 0 && n < MAX_PRICE)) return;
    if (i.foodRef) {
      const k = krPerKg(n, unit, units);
      if (k) props.onPrice({ foodRef: i.foodRef, krPerKg: k, updatedAt: Date.now() });
    } else props.onSave([{ ...i, kr: n, updatedAt: Date.now() }]);
    setEditing(false);
  };
  const clearPrice = () => {
    if (i.foodRef) props.onClearPrice(i.foodRef);
    else {
      const { kr: _kr, ...rest } = i;
      props.onSave([{ ...rest, updatedAt: Date.now() }]);
    }
    setEditing(false);
  };
  const stored = i.foodRef ? !!props.price : i.kr != null;

  return (
    <li class="shop-line">
      <div class="ingredient">
        <label class={i.checked ? 'shop-item done' : 'shop-item'}>
          <input type="checkbox" checked={!!i.checked} onChange={() => props.onSave([{ ...i, checked: !i.checked, updatedAt: Date.now() }])} />
          <span class="entry-name">{name}</span>
          <span class="num muted">
            {amountOf(i, units)}
            {cost && ` · ${cost.typical ? '≈' : cost.estimated ? '~' : ''}${fmt(cost.kr)} kr`}
            {props.share != null && cost && ` · ${fmt(props.share * 100)} %`}
          </span>
        </label>
        <button type="button" class="btn small" aria-expanded={editing} onClick={open}>
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
                {priceUnits(units).map((u) => (
                  <option key={u} value={u}>
                    kr/{u}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" class="btn" disabled={!(parseNum(kr) > 0 && parseNum(kr) < MAX_PRICE)}>
            {tsh('shopSavePrice')}
          </button>
          {stored && (
            <button type="button" class="btn danger" onClick={clearPrice}>
              {tsh('shopClearPrice')}
            </button>
          )}
          {i.foodRef && <p class="muted small block">{tsh('shopPriceHint')}</p>}
          {i.foodRef && props.typical != null && !props.price && (
            <p class="muted small block">{tsh('shopTypical').replace('{kr}', fmt(props.typical))}</p>
          )}
        </form>
      )}
    </li>
  );
}

/**
 * A line that re-renders only when its own data changed (a tick or a price elsewhere doesn't
 * re-render up to 300 lines on an old phone). Callbacks must be stable (useCallback in the sheet).
 */
class PureLine extends Component<LineProps> {
  shouldComponentUpdate(next: LineProps) {
    const a = this.props as unknown as Record<string, unknown>;
    const b = next as unknown as Record<string, unknown>;
    return Object.keys(b).some((k) => a[k] !== b[k]);
  }
  render() {
    return <Line {...this.props} />;
  }
}

/**
 * Shopping list (M28, M30): add what you ate this past week, saved meals, recipes or own items;
 * prices from the shelf give an estimated total and the biggest items first; tick off; share.
 */
export default function ShoppingSheet() {
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [prices, setPrices] = useState<Map<string, FoodPrice>>(new Map());
  // Typical prices (M33): only when food costs are on; loaded after the list is shown.
  const costsOn = !!settings.value.costs;
  const [typical, setTypical] = useState<Map<string, number> | undefined>(undefined);
  useEffect(() => {
    if (!costsOn) return setTypical(undefined);
    let live = true;
    typicalPrices().then((m) => live && setTypical(m), () => {}); // offline before it was cached: own prices only
    return () => {
      live = false;
    };
  }, [costsOn]);
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
  // Stable (no dependencies: they only use state setters), so lines don't re-render for nothing.
  const save = useCallback(async (changed: ShopItem[], removed: string[] = []) => {
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
  }, []);

  /** Remember what a food costs (kr/kg) for every line of it, now and later. */
  const savePrice = useCallback(async (p: FoodPrice) => {
    try {
      await putPrice(p);
    } catch {
      setStatus(tsh('shopSaveFailed'));
      return;
    }
    setPrices((cur) => new Map(cur).set(p.foodRef, p));
  }, []);

  /** Forget a food's price (a mistyped one shouldn't stay on every future list). */
  const clearPrice = useCallback(async (foodRef: string) => {
    try {
      await deletePrice(foodRef);
    } catch {
      setStatus(tsh('shopSaveFailed'));
      return;
    }
    setPrices((cur) => {
      const next = new Map(cur);
      next.delete(foodRef);
      return next;
    });
  }, []);
  const onSave = useCallback((c: ShopItem[], r?: string[]) => void save(c, r), [save]);
  const onPrice = useCallback((p: FoodPrice) => void savePrice(p), [savePrice]);
  const onClearPrice = useCallback((ref: string) => void clearPrice(ref), [clearPrice]);

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

  // Name, measures and section of each line worked out once per change (not per render and section).
  const info = useMemo(() => {
    const m = new Map<string, { name: string; units: Serving[]; section: Section }>();
    for (const i of items ?? []) {
      const name = nameOf(i);
      m.set(i.id, { name, units: unitsOf(i.foodRef), section: sectionOf(i.text ?? name) });
    }
    return m;
  }, [items, foods.value, userServings.value, lang.value]);
  const groups = useMemo(() => {
    const collator = new Intl.Collator(lang.value);
    return SECTIONS.map((section) => ({
      section,
      list: (items ?? [])
        .filter((i) => info.get(i.id)!.section === section)
        .sort((a, b) => Number(!!a.checked) - Number(!!b.checked) || collator.compare(info.get(a.id)!.name, info.get(b.id)!.name)),
    })).filter((g) => g.list.length);
  }, [items, info]);
  // Every line's cost once per change: the total, the ranking and each line's figure.
  const costs = useMemo(() => (items ? costList(items, prices, typical) : null), [items, prices, typical]);
  const costOf = useMemo(() => new Map((costs?.ranked ?? []).map((c) => [c.item.id, c])), [costs]);
  const ranked: Costed[] = byCostView ? (costs?.ranked ?? []) : [];

  // Offer links (M31): the user's chains, for the most expensive priced lines still to buy. Built
  // once per change so lines keep the same arrays (and don't re-render for nothing).
  const chosen = settings.value.chains ?? DEFAULT_CHAINS;
  const offersById = useMemo(() => {
    const chains = CHAINS.filter((c) => chosen.includes(c.id));
    const m = new Map<string, { name: string; href: string }[]>();
    if (!chains.length) return m;
    for (const c of (costs?.ranked ?? []).filter((r) => r.cost && !r.item.checked).slice(0, OFFER_LINES)) {
      const term = searchTerm(info.get(c.item.id)?.name ?? '', !!c.item.text);
      m.set(c.item.id, chains.map((ch) => ({ name: ch.name, href: ch.url(term) })));
    }
    return m;
  }, [costs, info, chosen]);
  const toggleChain = (id: string) =>
    void updateSettings({ chains: CHAINS.map((c) => c.id).filter((x) => (x === id ? !chosen.includes(id) : chosen.includes(x))) });

  const share = async () => {
    const text = toText(
      t('shoppingList'),
      groups.map((g) => ({
        title: tsh(SECTION_LABEL[g.section]),
        lines: g.list.filter((i) => !i.checked).map((i) => `${info.get(i.id)!.name} ${amountOf(i, info.get(i.id)!.units)}`.trim()),
      })),
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

  const line = (i: ShopItem, share?: number) => (
    <PureLine
      key={i.id}
      item={i}
      name={info.get(i.id)!.name}
      units={info.get(i.id)!.units}
      cost={costOf.get(i.id)?.cost ?? null}
      price={i.foodRef ? prices.get(i.foodRef) : undefined}
      typical={i.foodRef ? typical?.get(i.foodRef) : undefined}
      share={share}
      offers={byCostView ? offersById.get(i.id) : undefined}
      onSave={onSave}
      onPrice={onPrice}
      onClearPrice={onClearPrice}
    />
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
                {costs.typicalKr > 0 && <span class="muted small"> · {tsh('shopTotalTypical').replace('{kr}', fmt(costs.typicalKr))}</span>}
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
                <p class="muted small">{tsh(chosen.length ? 'shopOffersNote' : 'shopNoStores')}</p>
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
