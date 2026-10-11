import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addDays, changeShopping, entriesBetween, isoDate, listShopping, newId, type Entry } from '../lib/db';
import { fmt, lang } from '../lib/i18n';
import { foodName } from '../lib/nutrients';
import { servingsFor } from '../lib/servings';
import { addTo, expand, MAX_SHOP_ITEMS, sectionOf, SECTIONS, shopAmount, toText, type Section, type ShopItem } from '../lib/shopping';
import { tsh, type ShopKey } from '../lib/strings-shop';
import { t } from '../lib/i18n';
import { ensureFoods, foods, recipes, supplementRefs, templates, userServings } from '../state';
import { Sheet } from './Sheet';

const SECTION_LABEL: Record<Section, ShopKey> = {
  produce: 'secProduce', bread: 'secBread', dairy: 'secDairy', meat: 'secMeat', dry: 'secDry', frozen: 'secFrozen', other: 'secOther',
};

const nameOf = (item: ShopItem) => {
  if (item.text) return item.text;
  const f = foods.value.get(item.foodRef!);
  return f ? foodName(f, lang.value) : '…';
};

function amountOf(item: ShopItem): string {
  if (!item.foodRef || !item.grams) return '';
  const f = foods.value.get(item.foodRef);
  const a = shopAmount(item.grams, f ? servingsFor(f, userServings.value.get(item.foodRef)) : []);
  return `${fmt(a.qty, a.unit === 'l' || a.unit === 'kg' ? 2 : 0)} ${a.unit}`;
}

/** Shopping list (M28): add saved meals, recipes and planned days; tick off; share as text. */
export default function ShoppingSheet() {
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [planned, setPlanned] = useState<Entry[]>([]);
  const [status, setStatus] = useState('');
  const [own, setOwn] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    const today = isoDate(new Date());
    void Promise.all([listShopping(), entriesBetween(addDays(today, 1), addDays(today, 7))]).then(async ([list, next]) => {
      const p = next.filter((e) => !supplementRefs.value.has(e.foodRef));
      await ensureFoods([...list.flatMap((i) => (i.foodRef ? [i.foodRef] : [])), ...p.map((e) => e.foodRef)]);
      if (!live) return;
      setItems(list);
      setPlanned(p);
    });
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
            {groups.map((g) => (
              <section class="card" key={g.section}>
                <h2>{tsh(SECTION_LABEL[g.section])}</h2>
                <ul class="entries">
                  {g.list.map((i) => (
                    <li key={i.id} class="ingredient">
                      <label class={i.checked ? 'shop-item done' : 'shop-item'}>
                        <input type="checkbox" checked={!!i.checked} onChange={() => void save([{ ...i, checked: !i.checked, updatedAt: Date.now() }])} />
                        <span class="entry-name">{nameOf(i)}</span>
                        <span class="num muted">{amountOf(i)}</span>
                      </label>
                      <button type="button" class="btn small" aria-label={`${t('remove')} ${nameOf(i)}`} onClick={() => void save([], [i.id])}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
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

          <h3 class="suggest-sub">{tsh('shopPlanned')}</h3>
          {planned.length ? (
            <button type="button" class="btn wide" onClick={() => void add(planned.map((e) => ({ foodRef: e.foodRef, grams: e.grams })))}>
              + {tsh('shopPlannedCount').replace('{n}', String(planned.length))}
            </button>
          ) : (
            <p class="muted small">{tsh('shopNoPlanned')}</p>
          )}

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
