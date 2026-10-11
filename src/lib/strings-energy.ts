// Swedish strings for the adaptive energy card (Settings), kept out of the first bundle: this
// module loads only with that lazy screen. Other languages keep theirs in their pack (`energy` in
// lang/*.ts).
import { lang, packOf } from './i18n';

export const SV_ENERGY = {
  adaptiveTitle: 'Anpassad energiförbrukning',
  adaptiveToggle: 'Beräkna min förbrukning från vikt och intag',
  adaptiveNote: 'Jämför hur din vikt ändras med vad du har loggat de senaste fyra veckorna. Ditt energimål ändras bara om du själv väljer det.',
  adaptiveLoading: 'Räknar…',
  adaptiveResult: 'Uppskattad förbrukning: {kcal} kcal/dag (± {pm})',
  adaptiveBasis: 'Från {days} dagar och {weighIns} vägningar. Vikttrend: {trend} kg/vecka.',
  adaptiveNeedData: 'Behöver mer underlag: {days} av 10 dagar och {weighIns} av 3 vägningar, utspridda över minst två veckor.',
  adaptiveImplausible: 'Siffrorna går inte ihop – kanske saknas en del måltider i loggen. Markera dagar där allt är loggat och fortsätt väga dig.',
  adaptiveHowTo: 'Tryck ”Dagen är komplett” i dagboken när allt du ätit är loggat. Dagar med mycket lite loggat räknas annars inte.',
  adaptiveFormula: 'Formelns uppskattning: {kcal} kcal/dag',
  goal: 'Mål',
  goalLose: 'Gå ner i vikt',
  goalMaintain: 'Behålla vikten',
  goalGain: 'Gå upp i vikt',
  pace: 'Takt',
  paceOption: '{kg} kg/vecka',
  adaptiveTarget: 'Föreslaget energimål: {kcal} kcal/dag',
  adaptiveFloored: 'Begränsat till lägsta rekommenderade intag för dig ({kcal} kcal/dag).',
  adaptiveApply: 'Använd som mitt energimål',
  adaptiveIsTarget: 'Det här är ditt energimål nu. Det ändras inte av sig självt.',
  adaptiveNoGoal: 'Under graviditet och amning visas bara uppskattningen, inga mål för viktförändring.',
};

export type EnergyKey = keyof typeof SV_ENERGY;

// Swedish strings live here; other languages in their pack, falling back to English.
export const te = (key: EnergyKey): string =>
  lang.value === 'sv' ? SV_ENERGY[key] : (packOf(lang.value)?.energy?.[key] ?? packOf('en')?.energy?.[key] ?? SV_ENERGY[key]);
