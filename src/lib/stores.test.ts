import { describe, expect, it } from 'vitest';
import { CHAINS, DEFAULT_CHAINS, searchTerm } from './stores';

describe('offer links', () => {
  it('searches by the first word of a food name; own items by their text', () => {
    expect(searchTerm('Mjölk fett 3% berikad')).toBe('Mjölk');
    expect(searchTerm('Chicken, breast, raw')).toBe('Chicken');
    expect(searchTerm('Kycklingbröstfilé')).toBe('Kycklingbröstfilé');
    expect(searchTerm('Ost (hårdost) fett 28%')).toBe('Ost');
    expect(searchTerm('Glutenfri pasta', true)).toBe('Glutenfri pasta');
  });

  it("links to each store's own search, safely encoded; ICA to its offers page", () => {
    const url = (id: string) => CHAINS.find((c) => c.id === id)!.url('Kycklingfilé & ris');
    expect(url('willys')).toBe('https://www.willys.se/sok?q=Kycklingfil%C3%A9%20%26%20ris');
    expect(url('coop')).toBe('https://www.coop.se/handla/sok/?q=Kycklingfil%C3%A9%20%26%20ris');
    expect(url('ica')).toBe('https://www.ica.se/erbjudanden/');
    for (const c of CHAINS) expect(c.url('x')).toMatch(/^https:\/\/www\.[a-z]+\.se\//);
    expect(DEFAULT_CHAINS.every((id) => CHAINS.some((c) => c.id === id))).toBe(true);
  });
});
