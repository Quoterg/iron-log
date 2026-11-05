import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

// No Web Workers in Node: a stand-in food worker that knows no foods.
(globalThis as { Worker?: unknown }).Worker = class {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  postMessage(msg: { id: number; type: string }) {
    if (msg.type === 'search' || msg.type === 'get') queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, foods: [] } }));
  }
};
(globalThis as { document?: unknown }).document ??= { baseURI: 'http://localhost/', documentElement: {} };

describe('language switching in state', () => {
  it('the last language chosen wins, even if an earlier pack finishes loading later', async () => {
    const state = await import('../state');
    const { lang } = await import('./i18n');
    await Promise.all([state.updateSettings({ lang: 'en' }), state.updateSettings({ lang: 'sv' })]);
    expect(lang.value).toBe('sv');
    expect(state.settings.value.lang).toBe('sv');
  });

  it('Swedish searches the Swedish database by default, English both', async () => {
    const state = await import('../state');
    const base = { ...state.settings.value, sources: undefined };
    expect(state.activeSources({ ...base, lang: 'sv' })).toEqual(['slv']);
    expect(state.activeSources({ ...base, lang: 'en' })).toEqual(['slv', 'usda']);
  });
});
