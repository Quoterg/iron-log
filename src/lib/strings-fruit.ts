// Swedish strings of "Frukt i säsong" (M40), kept out of the first bundle: this module loads only with
// the fruit card and Settings. Other languages keep theirs in their pack (`fruit` in lang/*.ts).
import { lang, packOf } from './i18n';

export const SV_FRUIT = {
  fruitTitle: 'Frukt i säsong',
  fruitToggle: 'Föreslå frukt i säsong för det jag får för lite av',
  fruitNote: 'Av som standard. Visar vilka frukter det finns gott om i butikerna den här månaden och varifrån de kommer, och hur mycket av dem som skulle täcka det du får för lite av under en vecka.',
  fruitSource: 'Säsonger från SCB:s importstatistik (CC0), Eurostats handelsstatistik (Comext) och Jordbruksverkets statistik om svenska skördar, {period}. Uppdateras två gånger om året.',
  fruitLoading: 'Letar frukt i säsong…',
  fruitReach: 'Varifrån',
  reachSweden: 'Svenskt',
  reachEurope: 'Sverige + Europa',
  reachAny: 'Hela världen',
  fruitGoals: 'Mål för veckan',
  fruitWeek: 'En vecka i {month}:',
  fruitAmount: '{count} {unit} · {grams} g',
  fruitFromSweden: 'svensk',
  fruitFrom: 'mest från {country}',
  fruitFromFar: 'längre ifrån',
  fruitCovers: '{name}: {pct} % av det som saknas',
  fruitCapped: 'Mer frukt än så här på en vecka är inte rimligt – resten behöver komma från annan mat.',
  fruitCost: 'Kostar {kr} för veckan.',
  fruitSpan: 'Frukt är en källa till: {list}.',
  fruitNoNeeds: 'Frukt är ingen källa till det du får för lite av ({list}).',
  fruitNoSource: '{name}: ingen frukt i säsong är en källa just nu.',
  fruitNoSourceWider: '{name}: ingen frukt i säsong härifrån är en källa just nu. Från ”{reach}”: {fruits}.',
  fruitNoSourceLater: '{name}: ingen frukt i säsong är en källa just nu. {fruits} är i säsong {months}.',
  fruitCoversLittle: '{name}: {pct} % av det som saknas – frukten i säsong ger bara lite, resten behöver komma från annan mat.',
  fruitNoGaps: 'Du får tillräckligt av de vitaminer och mineraler som frukt bidrar med.',
  fruitNoGoal: 'Välj minst ett mål.',
  fruitNoneInSeason: 'Ingen frukt härifrån är i säsong just nu. Välj ett större område.',
  fruitAlso: 'Också i säsong: {list}',
};

export type FruitKey = keyof typeof SV_FRUIT;

// Swedish strings live here; other languages in their pack, falling back to English.
export const tf = (key: FruitKey): string =>
  lang.value === 'sv' ? SV_FRUIT[key] : (packOf(lang.value)?.fruit?.[key] ?? packOf('en')?.fruit?.[key] ?? SV_FRUIT[key]);
