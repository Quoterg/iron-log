import { useEffect, useState } from 'preact/hooks';
import { fmt, fmtAmount, lang, nutrientName } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX, NUTRIENTS, type Food } from '../lib/nutrients';
import type { Gap } from '../lib/report';
import { usualAmount } from '../lib/servings';
import { tg } from '../lib/strings-suggest';
import { gapFoods, swapFor, swapTargets, unitOf, type Candidate, type GapFood, type Swap } from '../lib/suggest';
import { everydayFoods } from '../lib/top';
import { open } from '../nav';
import { mealAt } from '../lib/usual';
import { activeSources, ensureFoods, foods, settings, supplementRefs, targets, usage } from '../state';

interface GapHelp {
  key: string;
  amount: number;
  target: number;
  foods: GapFood[];
}

/** The user's foods (logged at least twice), with their usual portion. */
async function ownFoods(): Promise<{ food: Food; grams: number; count: number }[]> {
  const list = [...usage.value.values()]
    .filter((u) => u.count >= 2 && u.lastUsed > 0 && !supplementRefs.value.has(u.foodRef))
    .sort((a, b) => b.count - a.count)
    .slice(0, 80);
  await ensureFoods(list.map((u) => u.foodRef));
  return list.flatMap((u) => {
    const food = foods.value.get(u.foodRef);
    return food ? [{ food, grams: usualAmount(u).grams, count: u.count }] : [];
  });
}

/**
 * Everyday foods rich in `key` per kcal (precomputed, with a household portion). During pregnancy no
 * liver products (Livsmedelsverket's advice: too much vitamin A).
 */
async function staples(key: string): Promise<Candidate[]> {
  const pregnant = (settings.value.profile.status ?? 'none').startsWith('pregnant');
  const rows = (await everydayFoods(key, activeSources(settings.value)).catch(() => [])).filter(([, sv]) => !(pregnant && /lever/i.test(sv)));
  await ensureFoods(rows.map((r) => r[0]));
  return rows.flatMap(([ref, , , , , portionG]) => {
    const food = foods.value.get(ref);
    return food ? [{ food, portionG, own: false }] : [];
  });
}

async function build(low: Gap[], amounts: number[]): Promise<{ gaps: GapHelp[]; swaps: Swap[] }> {
  const tgt = targets.value;
  const own = await ownFoods();
  const ownCands: Candidate[] = own.map((o) => ({ food: o.food, portionG: o.grams, own: true }));
  const gaps: GapHelp[] = [];
  // The two largest shortfalls that some everyday food can actually help with.
  for (const g of low.slice(0, 5)) {
    if (gaps.length === 2) break;
    const target = tgt[g.key]?.min;
    if (!target) continue;
    const amount = amounts[NUTRIENT_INDEX[g.key]];
    const list = gapFoods(g.key, target - amount, [...ownCands, ...(await staples(g.key))]);
    if (list.length) gaps.push({ key: g.key, amount, target, foods: list });
  }
  const frequent = own.filter((o) => o.count >= 3);
  await ensureFoods(swapTargets(frequent.map((o) => o.food)));
  const swaps = frequent
    .map((o) => {
      const rule = swapTargets([o.food])[0];
      return swapFor(o.food, rule ? foods.value.get(rule) : undefined, o.grams, tgt);
    })
    .filter((s): s is Swap => !!s)
    .slice(0, 3);
  return { gaps, swaps };
}

const name = (ref: string) => {
  const f = foods.value.get(ref);
  return f ? foodName(f, lang.value) : '…';
};
const nutrient = (key: string) => nutrientName(NUTRIENTS[NUTRIENT_INDEX[key]]);

/** Foods and swaps that help with the period's shortfalls (opt-in; see lib/suggest.ts). */
export default function Suggestions({ low, amounts }: { low: Gap[]; amounts: number[] }) {
  const [data, setData] = useState<{ gaps: GapHelp[]; swaps: Swap[] } | null>(null);
  const key = low.map((g) => g.key).join() + '|' + amounts.join();
  useEffect(() => {
    let live = true;
    setData(null);
    void build(low, amounts).then((d) => live && setData(d));
    return () => void (live = false);
  }, [key]);

  const empty = data && !data.swaps.length && !data.gaps.some((g) => g.foods.length);
  return (
    <section class="card suggest">
      <h2>{tg('suggestTitle')}</h2>
      {!data ? (
        <p class="muted small" role="status">{tg('suggestLoading')}</p>
      ) : empty ? (
        <p class="muted small">{tg('suggestNone')}</p>
      ) : (
        <>
          {data.gaps.filter((g) => g.foods.length).map((g) => (
            <div key={g.key} class="suggest-gap">
              <p class="small">
                {tg('gapLine').replace('{name}', nutrient(g.key)).replace('{amount}', fmtAmount(g.amount)).replace('{target}', fmtAmount(g.target)).replace('{unit}', unitOf(g.key))}
              </p>
              <ul class="entries">
                {g.foods.map((f) => (
                  <li key={f.ref}>
                    <button class="result" onClick={() => open({ kind: 'food', ref: f.ref, meal: mealAt(new Date()) })}>
                      <span class="entry-name">
                        {name(f.ref)}
                        {f.own && <span class="badge">{tg('gapYouEat')}</span>}
                      </span>
                      <span class="muted">
                        {tg('gapPortion').replace('{grams}', fmt(f.portionG)).replace('{pct}', fmt(f.covers * 100))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {data.swaps.length > 0 && (
            <>
              <h3 class="suggest-sub">{tg('swapsTitle')}</h3>
              <ul class="entries">
                {data.swaps.map((s) => (
                  <li key={s.from}>
                    <button class="result" onClick={() => open({ kind: 'food', ref: s.to, meal: mealAt(new Date()) })}>
                      <span class="entry-name">{tg('swapLine').replace('{to}', name(s.to)).replace('{from}', name(s.from))}</span>
                      <span class="muted">
                        {s.changes.map((c) => `${c.delta > 0 ? '+' : '−'}${fmtAmount(Math.abs(c.delta))} ${unitOf(c.key)} ${nutrient(c.key).toLowerCase()}`).join(', ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
