import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

// Minimal DOM bits the state module touches (no browser in Node).
(globalThis as { document?: unknown }).document ??= { baseURI: 'http://localhost/', documentElement: {} };

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

describe('body log in state and storage', () => {
  it('the newest weight drives the profile, also after deleting the newest entry', async () => {
    const state = await import('../state');
    await state.saveBody({ date: daysAgo(5), weightKg: 82, updatedAt: 1 });
    await state.saveBody({ date: daysAgo(1), weightKg: 80, updatedAt: 2 });
    await state.saveBody({ date: daysAgo(3), weightKg: 81, updatedAt: 3 }); // back-dated
    expect(state.settings.value.profile.weightKg).toBe(80);

    // Delete the newest (empty entry for that day) → falls back to the next newest, not a stale value.
    await state.saveBody({ date: daysAgo(1), updatedAt: 4 });
    expect(state.bodyLog.value?.map((e) => e.date)).not.toContain(daysAgo(1));
    expect(state.settings.value.profile.weightKg).toBe(81);
  });

  it('refuses future dates', async () => {
    const state = await import('../state');
    await expect(state.saveBody({ date: daysAgo(-1), weightKg: 70, updatedAt: 5 })).rejects.toThrow(/future/);
  });

  it('import keeps the newer measurement for a day', async () => {
    const db = await import('./db');
    const empty = { entries: [], customFoods: [], usage: [], servings: [], offFoods: [], recipes: [] };
    await db.putBody({ date: '2026-01-01', weightKg: 75, updatedAt: 10 });
    await db.importAll({ ...empty, body: [{ date: '2026-01-01', weightKg: 99, updatedAt: 5 }] });
    expect((await db.listBody()).find((b) => b.date === '2026-01-01')?.weightKg).toBe(75);
    await db.importAll({ ...empty, body: [{ date: '2026-01-01', weightKg: 74, updatedAt: 20 }] });
    expect((await db.listBody()).find((b) => b.date === '2026-01-01')?.weightKg).toBe(74);
  });
});
