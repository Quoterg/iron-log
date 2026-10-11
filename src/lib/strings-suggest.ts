// Swedish strings for suggestions, swaps and the "what if" preview (M27), kept out of the first
// bundle: this module loads only with those lazy pieces. Other languages keep theirs in their pack
// (`suggest` in lang/*.ts).
import { lang, packOf } from './i18n';

export const SV_SUGGEST = {
  suggestTitle: 'Förslag',
  suggestToggle: 'Föreslå livsmedel och byten för näringsämnen jag får för lite av',
  suggestNote: 'Av som standard. Bygger på dina egna livsmedel och Livsmedelsverkets data och följer NNR 2023 – inga råd om doser eller kosttillskott.',
  whatIfToggle: 'Visa ”Vad händer om” när jag lägger till ett livsmedel',
  suggestLoading: 'Letar efter förslag…',
  suggestNone: 'Inga tydliga förslag just nu.',
  gapLine: '{name}: i snitt {amount} av {target} {unit} per dag',
  gapPortion: '{grams} g ger {pct} % av det som saknas',
  gapYouEat: 'du äter redan',
  swapsTitle: 'Byten att prova',
  swapLine: '{to} i stället för {from}',
  whatIfTitle: 'Om du lägger till',
};

export type SuggestKey = keyof typeof SV_SUGGEST;

// Swedish strings live here; other languages in their pack, falling back to English.
export const tg = (key: SuggestKey): string =>
  lang.value === 'sv' ? SV_SUGGEST[key] : (packOf(lang.value)?.suggest?.[key] ?? packOf('en')?.suggest?.[key] ?? SV_SUGGEST[key]);
