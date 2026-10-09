// Full-screen sheets as a stack, mirrored in browser history so the Android back
// button (and back gesture) closes the top sheet instead of leaving the app.
import { computed, signal } from '@preact/signals';
import type { Meal } from './lib/db';

export type Screen =
  /** Search to add a food to a meal, or to swap the food of an existing entry. */
  | { kind: 'search'; meal: Meal; replaceEntryId?: string }
  /** Food detail: add a new entry (meal set), or edit an existing one (entryId set). */
  | { kind: 'food'; ref: string; meal?: Meal; entryId?: string }
  /** Create (no ref) or edit a custom food. `meal` continues to adding it afterwards. */
  | { kind: 'editFood'; ref?: string; name?: string; meal?: Meal }
  /** Copy the shown day's entries (or one meal's) to another date/meal. */
  | { kind: 'copy'; meal?: Meal };

export const stack = signal<Screen[]>([]);
export const top = computed(() => stack.value[stack.value.length - 1]);

export function open(s: Screen): void {
  stack.value = [...stack.value, s];
  history.pushState({ depth: stack.value.length }, '');
}

/** Swap the top sheet without adding a history step. */
export function replaceTop(s: Screen): void {
  stack.value = [...stack.value.slice(0, -1), s];
}

export function back(): void {
  if (stack.value.length) history.back();
}

export function closeAll(): void {
  const n = stack.value.length;
  if (n) history.go(-n);
}

export function initNav(): void {
  history.replaceState({ depth: 0 }, '');
  window.addEventListener('popstate', (e: PopStateEvent) => {
    const depth = (e.state as { depth?: number } | null)?.depth ?? 0;
    stack.value = stack.value.slice(0, depth);
  });
}
