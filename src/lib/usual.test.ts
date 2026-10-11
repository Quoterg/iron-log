import { describe, expect, it } from 'vitest';
import type { Entry, Meal } from './db';
import { accept, dismiss, hidden, inWindow, mealAt, type UsualState } from './usual';
import { comparableDays, findUsual } from './usual-find';

const MONDAY = '2026-10-12';
const KCAL: Record<string, number> = { oats: 150, milk: 80, banana: 90, egg: 140, bread: 200, coffee: 2 };
const kcalOf = (e: Entry) => KCAL[e.foodRef] * (e.grams / 100);
let n = 0;
/** A meal on `date` with the given foods (100 g each), logged that day at `hh:mm`. */
function meal(date: string, foods: string[], at = '07:30', m: Meal = 'breakfast'): Entry[] {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = at.split(':').map(Number);
  const t = new Date(y, mo - 1, d, h, mi).getTime();
  return foods.map((f, i) => ({ id: `e${n++}`, date, meal: m, foodRef: f, grams: 100, createdAt: t + i }));
}
const at = (date: string, hhmm: string) => {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi);
};

describe('your usual', () => {
  it('compares weekdays with weekdays and weekends with weekends (last 6 of each)', () => {
    expect(comparableDays(MONDAY)).toEqual(['2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-02']);
    expect(comparableDays('2026-10-10')).toEqual(['2026-10-04', '2026-10-03', '2026-09-27', '2026-09-26', '2026-09-20', '2026-09-19']);
  });

  it('needs the same meal on ≥ 4 of the last 6 comparable days', () => {
    const [d1, d2, d3, d4, d5] = comparableDays(MONDAY);
    const three = [...meal(d1, ['oats', 'milk']), ...meal(d2, ['oats', 'milk']), ...meal(d3, ['milk', 'oats']), ...meal(d4, ['egg', 'bread'])];
    expect(findUsual(MONDAY, 'breakfast', three, kcalOf)).toBeNull();
    const four = [...three, ...meal(d5, ['oats', 'milk'])];
    const u = findUsual(MONDAY, 'breakfast', four, kcalOf)!;
    expect(u.items.map((i) => i.foodRef)).toEqual(['oats', 'milk']); // from the most recent day
    expect(u.kcal).toBe(230);
    // Only that slot: lunch has nothing.
    expect(findUsual(MONDAY, 'lunch', four, kcalOf)).toBeNull();
    // Weekend days don't count for a Monday.
    const weekend = ['2026-10-11', '2026-10-10', '2026-10-04', '2026-10-03'].flatMap((d) => meal(d, ['egg']));
    expect(findUsual(MONDAY, 'breakfast', weekend, kcalOf)).toBeNull();
  });

  it('"the same" means ≥ 80 % of the energy from the same foods, both ways', () => {
    const days = comparableDays(MONDAY);
    // Oats + milk (230 kcal) vs. oats + milk + banana (320): 230/320 = 72 % shared → not the same.
    const mixed = [...meal(days[0], ['oats', 'milk']), ...meal(days[1], ['oats', 'milk', 'banana']), ...meal(days[2], ['oats', 'milk']), ...meal(days[3], ['oats', 'milk', 'banana'])];
    expect(findUsual(MONDAY, 'breakfast', mixed, kcalOf)).toBeNull();
    // A coffee on top (2 kcal) doesn't make it a different meal.
    const coffee = [...meal(days[0], ['oats', 'milk', 'coffee']), ...meal(days[1], ['oats', 'milk']), ...meal(days[2], ['oats', 'milk']), ...meal(days[3], ['oats', 'milk', 'coffee'])];
    expect(findUsual(MONDAY, 'breakfast', coffee, kcalOf)?.items.map((i) => i.foodRef)).toEqual(['oats', 'milk', 'coffee']);
  });

  it('is offered around the time it is usually logged, else at the meal\'s usual time of day', () => {
    const days = comparableDays(MONDAY).slice(0, 4);
    const u = findUsual(MONDAY, 'breakfast', days.flatMap((d, i) => meal(d, ['oats'], ['07:00', '07:20', '07:45', '08:00'][i])), kcalOf)!;
    expect(u.window).toEqual([6 * 60, 9 * 60 + 30]);
    expect(inWindow(u, at(MONDAY, '06:30'))).toBe(true);
    expect(inWindow(u, at(MONDAY, '09:45'))).toBe(false);
    // Logged afterwards on another day (createdAt not on the entry's date): default window.
    const late = days.flatMap((d) => meal(d, ['oats']).map((e) => ({ ...e, createdAt: e.createdAt + 3 * 864e5 })));
    expect(findUsual(MONDAY, 'breakfast', late, kcalOf)!.window).toEqual([5 * 60, 10 * 60 + 30]);
  });

  it('a dismissal hides it for the day; three in a row pause it for 14 days; logging it resets the count', () => {
    let s: UsualState = {};
    s = dismiss(s, 'breakfast', '2026-10-12');
    expect(hidden(s, 'breakfast', '2026-10-12')).toBe(true);
    expect(hidden(s, 'breakfast', '2026-10-13')).toBe(false);
    expect(hidden(s, 'lunch', '2026-10-12')).toBe(false);
    s = dismiss(s, 'breakfast', '2026-10-12'); // twice the same day counts once
    s = dismiss(s, 'breakfast', '2026-10-13');
    expect(s.breakfast?.streak).toBe(2);
    s = accept(s, 'breakfast');
    s = dismiss(s, 'breakfast', '2026-10-14');
    s = dismiss(s, 'breakfast', '2026-10-15');
    expect(hidden(s, 'breakfast', '2026-10-16')).toBe(false);
    s = dismiss(s, 'breakfast', '2026-10-16'); // third in a row
    expect(hidden(s, 'breakfast', '2026-10-29')).toBe(true);
    expect(hidden(s, 'breakfast', '2026-10-30')).toBe(false);
  });

  it('shortcuts add to the meal of the time of day', () => {
    expect(mealAt(at(MONDAY, '07:00'))).toBe('breakfast');
    expect(mealAt(at(MONDAY, '12:00'))).toBe('lunch');
    expect(mealAt(at(MONDAY, '18:30'))).toBe('dinner');
    expect(mealAt(at(MONDAY, '15:00'))).toBe('snack');
    expect(mealAt(at(MONDAY, '23:00'))).toBe('snack');
  });
});
