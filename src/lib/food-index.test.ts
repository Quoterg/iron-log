import { describe, expect, it } from 'vitest';
import { CUSTOM_BOOST, FoodIndex, POPULAR_BOOST } from './food-index';
import type { Food } from './nutrients';

const food = (ref: string, sv: string): Food => ({ ref, sv, en: null, per100g: [] });
const db = [food('slv:1', 'Havregryn fullkorn'), food('slv:2', 'Havregrynsgröt kokt'), food('slv:3', 'Mjölk fett 3%')];
const boosts = (ix: FoodIndex, lang = 'sv') => Object.fromEntries(ix.indexFor(lang).map((e) => [e.i, e.boost]));

describe('the two-part search index (review #97)', () => {
  it('own foods keep their boost when no database is loaded, also after a boost update', () => {
    const ix = new FoodIndex();
    ix.setCustom([food('custom:a', 'Min gröt'), food('custom:b', 'Mitt bröd')]);
    expect(boosts(ix)).toEqual({ 0: CUSTOM_BOOST, 1: CUSTOM_BOOST });
    ix.setBoosts({ 'custom:a': 3 });
    expect(boosts(ix)).toEqual({ 0: CUSTOM_BOOST + 3, 1: CUSTOM_BOOST });
    expect(ix.search('m', 'sv', 10).map((f) => f.ref)[0]).toBe('custom:a');
  });

  it('a change to own foods keeps the databases’ index; new own foods are found at once', () => {
    const ix = new FoodIndex();
    ix.setBuiltIn(db);
    ix.search('havre', 'sv', 10);
    expect(ix.hasBuiltInIndex('sv')).toBe(true);
    ix.setCustom([food('custom:h', 'Havregryn eko, eget')]);
    expect(ix.hasBuiltInIndex('sv')).toBe(true);
    expect(ix.search('havregryn', 'sv', 10).map((f) => f.ref)).toContain('custom:h');
    // A database change rebuilds it.
    ix.setBuiltIn(db.slice(0, 1));
    expect(ix.hasBuiltInIndex('sv')).toBe(false);
  });

  it('boost updates reach both parts, by the part they are in', () => {
    const ix = new FoodIndex();
    ix.popular.add('slv:3');
    ix.setBuiltIn(db);
    ix.setCustom([food('custom:m', 'Mjölk eget')]);
    ix.indexFor('sv');
    ix.setBoosts({ 'slv:1': 4, 'custom:m': 2 });
    expect(boosts(ix)).toEqual({ 0: 4, 1: 0, 2: POPULAR_BOOST, 3: CUSTOM_BOOST + 2 });
    // Before the combined index exists (only the databases' part is built), the update still lands.
    const ix2 = new FoodIndex();
    ix2.setBuiltIn(db);
    ix2.indexFor('sv');
    ix2.setCustom([food('custom:m', 'Mjölk eget')]);
    ix2.setBoosts({ 'slv:2': 1 });
    expect(boosts(ix2)).toEqual({ 0: 0, 1: 1, 2: 0, 3: CUSTOM_BOOST });
  });

  it('with the same match, an own food comes before a database food', () => {
    const ix = new FoodIndex();
    ix.setBuiltIn([food('slv:9', 'Kvarg naturell')]);
    ix.setCustom([food('custom:k', 'Kvarg naturell')]);
    expect(ix.search('kvarg', 'sv', 10).map((f) => f.ref)).toEqual(['custom:k', 'slv:9']);
  });
});
