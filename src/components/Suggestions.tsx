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

export interface GapHelp {
  key: string;
  amount: number;
  target: number;
  foods: GapFood[];
}

/** The user's food usage (logged at least twice, not supplements), most used first. */
function ownUsage() {
  return [...usage.value.values()]
    .filter((u) => u.count >= 2 && u.lastUsed > 0 && !supplementRefs.value.has(u.foodRef))
    .sort((a, b) => b.count - a.count)
    .slice(0, 80);
}

/** The user's foods with their usual portion (foods must be loaded: see build). */
export function ownFoods(): { food: Food; grams: number; count: number }[] {
  return ownUsage().flatMap((u) => {
    const food = foods.value.get(u.foodRef);
    return food ? [{ food, grams: usualAmount(u).grams, count: u.count }] : [];
  });
}

/** Everyday foods rich in `key` per kcal (precomputed, with a household portion), unloaded rows. */
export const staples = (key: string) => everydayFoods(key, activeSources(settings.value)).catch(() => []);

export const isPregnant = () => (settings.value.profile.status ?? 'none').startsWith('pregnant');

export async function buildSuggestions(low: Gap[], amounts: number[]): Promise<{ gaps: GapHelp[]; swaps: Swap[] }> {
  const tgt = targets.value;
  const keys = low.slice(0, 5).map((g) => g.key).filter((k) => tgt[k]?.min);
  const rows = new Map(await Promise.all(keys.map(async (k) => [k, await staples(k)] as const)));
  // One load for everything: own foods, everyday foods for each gap, swap alternatives.
  const usageRefs = ownUsage().map((u) => u.foodRef);
  await ensureFoods([...usageRefs, ...[...rows.values()].flat().map((r) => r[0])]);
  const own = ownFoods();
  await ensureFoods(swapTargets(own.filter((o) => o.count >= 3).map((o) => o.food)));

  const ownCands: Candidate[] = own.map((o) => ({ food: o.food, portionG: o.grams, own: true }));
  const pregnant = isPregnant();
  const gaps: GapHelp[] = [];
  // The two largest shortfalls that some everyday food can actually help with.
  for (const key of keys) {
    if (gaps.length === 2) break;
    const target = tgt[key].min!;
    const amount = amounts[NUTRIENT_INDEX[key]];
    const everyday = (rows.get(key) ?? []).flatMap(([ref, , , , , portionG]) => {
      const food = foods.value.get(ref);
      return food ? [{ food, portionG, own: false }] : [];
    });
    const list = gapFoods(key, target - amount, [...ownCands, ...everyday], 3, { pregnant });
    if (list.length) gaps.push({ key, amount, target, foods: list });
  }
  const swaps = own
    .filter((o) => o.count >= 3)
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
  // Refresh when the gaps, the food sources, pregnancy status or the user's foods change.
  const sv = settings.value;
  const key = [low.map((g) => g.key).join(), amounts.join(), activeSources(sv).join(), sv.profile.status ?? '', [...usage.value.values()].reduce((n, u) => n + u.count, 0)].join('|');
  useEffect(() => {
    let live = true;
    setData(null);
    void buildSuggestions(low, amounts).then((d) => live && setData(d));
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
