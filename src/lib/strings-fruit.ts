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
  fruitWeek: 'Att handla för en vecka i {month}:',
  fruitCoverage: 'Det täcker av det du får för lite av:',
  fruitChip: '{name} {pct} %',
  fruitNotNow: 'Ingen frukt i säsong härifrån för: {list}.',
  fruitNotNowWider: '{names} – från ”{reach}”: {fruits}',
  fruitNotNowLater: '{name} – {fruits} {months}',
  fruitMore: 'Mer',
  fruitAmount: '{count} {unit} · {grams} g',
  fruitFromSweden: 'svensk',
  fruitFrom: 'mest från {country}',
  fruitFromFar: 'längre ifrån',
  fruitCapped: 'Mer frukt än så här på en vecka är inte rimligt – resten behöver komma från annan mat.',
  fruitUncertain: 'Osäkert för {list}: en del av maten du loggat saknar uppgifter om dem (t.ex. skannade varor), så du kan få mer än det som visas.',
  fruitCost: 'Kostar {kr} för veckan.',
  fruitSpan: 'Frukt är en källa till: {list}.',
  fruitNoNeeds: 'Frukt är ingen källa till det du får för lite av ({list}).',
  fruitNoGaps: 'Du får tillräckligt av de vitaminer och mineraler som frukt bidrar med.',
  fruitNoGoal: 'Välj minst ett mål.',
  fruitAlso: 'Också i säsong: {list}',
};

export type FruitKey = keyof typeof SV_FRUIT;

// Swedish strings live here; other languages in their pack, falling back to English.
export const tf = (key: FruitKey): string =>
  lang.value === 'sv' ? SV_FRUIT[key] : (packOf(lang.value)?.fruit?.[key] ?? packOf('en')?.fruit?.[key] ?? SV_FRUIT[key]);
