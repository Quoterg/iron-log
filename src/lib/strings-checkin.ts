// Swedish strings for the weekly check-in (M26), kept out of the first bundle: this module loads
// only with the check-in sheet and the Settings card. Other languages keep theirs in their pack
// (`checkin` in lang/*.ts).
import { lang, packOf } from './i18n';

export const SV_CHECKIN = {
  checkinTitle: 'Veckans avstämning',
  checkinToggle: 'Visa en kort avstämning av förra veckan i dagboken',
  checkinNote: 'Av som standard. En gång i veckan: snitt, vikt och, om du vill, ett förslag. Inga påminnelser.',
  checkinWeek: 'Vecka {week} · {from}–{to}',
  checkinLoading: 'Räknar ihop veckan…',
  checkinNothing: 'Inget loggat förra veckan.',
  checkinDays: '{n} av 7 dagar loggade',
  checkinEnergy: 'Energi i snitt {kcal} kcal per loggad dag (mål {target})',
  checkinWeight: 'Vikt: {change} kg jämfört med veckan innan',
  checkinCost: 'Maten kostade {kr} förra veckan ({day}/dag).',
  checkinCostChange: '{pct} % per dag mot veckan innan.',
  checkinNoWeight: 'Inga vägningar att jämföra med veckan innan.',
  checkinExpenditure: 'Uppskattad förbrukning (senaste 4 veckorna): {kcal} kcal/dag',
  checkinTarget: 'Förslag på energimål ({goal}): {kcal} kcal/dag',
  checkinApply: 'Använd',
  checkinApplied: 'Ditt energimål är nu {kcal} kcal/dag.',
  checkinWell: 'Det här gick bra',
  wellLogged: 'Du loggade {n} av 7 dagar.',
  wellEnergy: 'Energin låg nära ditt mål.',
  wellNutrient: '{name}: i snitt över målet.',
  checkinTip: 'Ett förslag',
  tipGap: '{name} låg i snitt på {amount} av {target} {unit}. {food}: {grams} g ger {pct} % av det som saknas.',
  tipSwap: 'Prova {to} i stället för {from}: {changes}.',
  checkinDone: 'Klar',
};

export type CheckinKey = keyof typeof SV_CHECKIN;

// Swedish strings live here; other languages in their pack, falling back to English.
export const tc = (key: CheckinKey): string =>
  lang.value === 'sv' ? SV_CHECKIN[key] : (packOf(lang.value)?.checkin?.[key] ?? packOf('en')?.checkin?.[key] ?? SV_CHECKIN[key]);
