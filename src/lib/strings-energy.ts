// Swedish strings for the adaptive energy card (Settings), kept out of the first bundle: this
// module loads only with that lazy screen. Other languages keep theirs in their pack (`energy` in
// lang/*.ts).
import { fmt, lang, packOf } from './i18n';
import type { Goal } from './targets';

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
  followOnTarget: 'Ditt energimål ligger redan på det föreslagna. Det justeras varje vecka om din vikt ändras annorlunda än målet.',
  adaptiveNoGoal: 'Under graviditet och amning visas bara uppskattningen, inga mål för viktförändring.',
  goalWhere: 'Mål: {goal} (ändras under Profil).',
  goalFormula: 'Förbrukning ca {need} kcal, {delta} kcal/dag för {kg} kg/vecka.',
  followToggle: 'Följ uppskattningen automatiskt (högst ±{kcal} kcal per vecka)',
  followExplain: 'En gång i veckan flyttas ditt energimål mot det föreslagna, högst {kcal} kcal åt gången, så att en enstaka vecka inte svänger det. Du ser ändringen i dagboken. Målet räknas då inte längre fram ur formeln i Profil.',
  goalNotice: 'Ditt viktmål gäller nu också det automatiska energimålet, som därför är {kcal} kcal/dag. Kontrollera Mål och Takt.',
  followActive: 'Energimålet följer nu din uppmätta förbrukning (Anpassad energiförbrukning): en gång i veckan när underlaget räcker, och direkt när du byter mål eller takt. Stäng av det där för att räkna ut målet från profilen igen.',
  whyMeasured: 'Uppmätt förbrukning: {kcal} kcal/dag – från {days} loggade dagar och {weighIns} vägningar, där vikten ändrades {trend} kg/vecka.',
  whyIntake: 'Du åt i snitt {intake} kcal/dag de {days} dagar som räknas (de senaste fyra veckorna, till och med igår).',
  whySkipped: '{n} loggade dagar räknades inte: de låg under 60 % av en vanlig dag utan att vara markerade ”Dagen är komplett”, eller hade livsmedel utan energivärde.',
  whyWeight: 'Vikten ändrades {trend} kg/vecka enligt {weighIns} vägningar – det motsvarar {balance} kcal/dag (7 700 kcal per kg).',
  whySum: 'Förbrukning: {intake} {op} {balance} = {kcal} kcal/dag.',
  whyGoal: 'Ditt mål: {goal} → {delta} kcal/dag.',
  whyWant: 'Det ger ett energimål på {kcal} kcal/dag.',
  whyCapped: 'För att en enstaka vecka inte ska svänga målet flyttas det högst {step} kcal per vecka: {from} → {to} kcal/dag. Nästa vecka fortsätter det mot {want}.',
  whyReached: 'Energimålet ändrades: {from} → {to} kcal/dag.',
  whyGoalChange: 'Du bytte mål från ”{fromGoal}” till ”{goal}”: {delta} kcal/dag direkt, {from} → {to} kcal/dag.',
  whyGoalNext: 'Varje vecka justeras det sedan efter hur din vikt faktiskt ändras.',
  whyLast: 'Senaste ändringen av energimålet ({date}):',
  followNext: 'Nästa steg (vecka {week}): {from} → {to} kcal/dag, mot {want}.',
};

export type EnergyKey = keyof typeof SV_ENERGY;

// Swedish strings live here; other languages in their pack, falling back to English.
export const te = (key: EnergyKey): string =>
  lang.value === 'sv' ? SV_ENERGY[key] : (packOf(lang.value)?.energy?.[key] ?? packOf('en')?.energy?.[key] ?? SV_ENERGY[key]);

export const GOAL_LABEL: Record<Goal, 'goalLose' | 'goalMaintain' | 'goalGain'> = { lose: 'goalLose', maintain: 'goalMaintain', gain: 'goalGain' };

/** "Gå ner i vikt, 0,5 kg/vecka" — a goal and its pace, in words. */
export function goalText(goal: Goal, pace: number): string {
  return goal === 'maintain' ? te('goalMaintain') : `${te(GOAL_LABEL[goal])}, ${te('paceOption').replace('{kg}', fmt(pace, 2))}`;
}
