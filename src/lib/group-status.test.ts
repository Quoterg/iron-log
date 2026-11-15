import { describe, expect, it } from 'vitest';
import { groupCount, groupStatus } from './group-status';

const targets = {
  a: { min: 10, max: null },
  b: { min: 5, max: null },
  c: { min: 1, max: null },
  salt: { min: null, max: 6 },
  free: undefined,
};

describe('group status (M66)', () => {
  it('counts targets reached, under and limits passed', () => {
    expect(groupCount(['a', 'b', 'c', 'salt', 'free'], [2, 5, 0, 7, 99], targets)).toEqual({ withMin: 3, under: 2, over: 1 });
  });

  it('a finished day or a period says how many are under target', () => {
    expect(groupStatus({ withMin: 13, under: 10, over: 0 }, false)).toEqual([{ kind: 'under', n: 10 }]);
    expect(groupStatus({ withMin: 13, under: 0, over: 0 }, false)).toEqual([]);
  });

  it('today, still going, says how many are reached so far instead of "10 under målet"', () => {
    expect(groupStatus({ withMin: 13, under: 10, over: 0 }, true)).toEqual([{ kind: 'reached', n: 3, m: 13 }]);
    expect(groupStatus({ withMin: 13, under: 13, over: 0 }, true)).toEqual([{ kind: 'reached', n: 0, m: 13 }]);
  });

  it('a limit passed is said either way', () => {
    expect(groupStatus({ withMin: 0, under: 0, over: 1 }, true)).toEqual([{ kind: 'over', n: 1 }]);
    expect(groupStatus({ withMin: 2, under: 1, over: 1 }, false)).toEqual([
      { kind: 'under', n: 1 },
      { kind: 'over', n: 1 },
    ]);
  });
});
