// What's new per release (M32), newest first. Loaded only with the WhatsNew sheet (import it from
// nowhere else). Releasing = bump "version" in package.json and add an entry here, in every language
// (CLAUDE.md). Keep each note short and plain, and only the latest ~10 releases.
import type { Lang } from './lib/i18n';
import { compareVersions } from './lib/version';

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  notes: Record<Lang, string[]>;
}

export const RELEASES: Release[] = [
  {
    version: '1.7.0',
    date: '2026-10-21',
    notes: {
      sv: [
        'Nytt: Frukt i säsong (slå på under Inställningar → Förslag). Visar vilka frukter det finns gott om i butikerna den här månaden och varifrån de kommer – från svensk skörd och importstatistik.',
        'Den föreslår också hur mycket frukt under en vecka som täcker de vitaminer och mineraler du får för lite av. Välj själv målen och om frukten ska vara svensk, från Europa eller från hela världen.',
      ],
      en: [
        'New: Fruit in season (turn it on under Settings → Suggestions). Shows which fruits are plentiful in the shops this month and where they come from – from Swedish harvests and import statistics.',
        'It also suggests how much fruit in a week would cover the vitamins and minerals you get too little of. Choose the goals yourself, and whether the fruit should be Swedish, from Europe or from anywhere.',
      ],
    },
  },
  {
    version: '1.6.6',
    date: '2026-10-16',
    notes: {
      sv: [
        'Snabbare start: appen startar från telefonen och väntar inte på nätet – även med dålig täckning.',
        'När en ny version har hämtats i bakgrunden visas ”Starta om” – annars används den nästa gång du öppnar appen.',
      ],
      en: [
        'Faster start: the app starts from your phone and doesn’t wait for the network – even with poor signal.',
        'When a new version has been downloaded in the background, “Restart” is offered – otherwise it’s used the next time you open the app.',
      ],
    },
  },
  {
    version: '1.6.5',
    date: '2026-10-15',
    notes: {
      sv: [
        'Med Matkostnad på: Näringsämnen visar vad maten kostar i snitt per dag, vecka och månad (7 och 30 dagar).',
        'Veckans avstämning säger vad maten kostade förra veckan och hur det ändrats mot veckan innan.',
      ],
      en: [
        'With Food cost on: Nutrients shows the average food cost per day, week and month (7 and 30 days).',
        'The weekly check-in says what your food cost last week and how that changed from the week before.',
      ],
    },
  },
  {
    version: '1.6.0',
    date: '2026-10-15',
    notes: {
      sv: [
        'Hitta skannade varor igen: under ”Skannade varor” i sökningen finns allt du någonsin skannat, senast använda först.',
        'Sök på det som står på förpackningen – t.ex. ”proteinkvarg”, märket eller de sista siffrorna i streckkoden.',
      ],
      en: [
        'Find scanned products again: “Scanned products” in the search lists everything you have ever scanned, most recently used first.',
        'Search for what is on the package – e.g. “protein quark”, the brand or the last digits of the barcode.',
      ],
    },
  },
  {
    version: '1.5.0',
    date: '2026-10-14',
    notes: {
      sv: [
        'Mål och takt finns nu i Inställningar → Profil, bredvid energimålet: Gå ner, Behålla eller Gå upp, 0,25–0,75 kg i veckan.',
        'Det automatiska energimålet följer målet direkt (t.ex. −550 kcal/dag för 0,5 kg i veckan), aldrig under en säker miniminivå.',
        'Valbart: låt energimålet följa din uppmätta förbrukning en gång i veckan, högst ±150 kcal åt gången. Du ser ändringen i dagboken.',
      ],
      en: [
        'Goal and pace are now in Settings → Profile, next to the energy target: Lose, Maintain or Gain, 0.25–0.75 kg a week.',
        'The automatic energy target follows the goal right away (e.g. −550 kcal/day for 0.5 kg a week), never below a safe minimum.',
        'Optional: let the energy target follow your measured expenditure once a week, at most ±150 kcal at a time. You’ll see the change in the diary.',
      ],
    },
  },
  {
    version: '1.4.0',
    date: '2026-10-13',
    notes: {
      sv: [
        'Matkostnad (valbart): ungefärliga priser för över 2 300 livsmedel – i dagboken per livsmedel, måltid och dag, och i inköpslistan. Slå på i Inställningar → Matkostnad.',
        'Tryck på en kostnad i dagboken för att skriva in ditt eget pris; det används också i inköpslistan.',
        'Priserna uppdateras två gånger per år med SCB:s prisindex. Allt finns i appen – inget hämtas från butiker.',
        'Använder du appen på flera enheter: uppdatera alla, annars kan en äldre version slå av Matkostnad igen.',
      ],
      en: [
        'Food cost (optional): approximate prices for over 2,300 foods – in the diary per food, meal and day, and on the shopping list. Turn on in Settings → Food cost.',
        'Tap a cost in the diary to type your own price; it is used on the shopping list too.',
        'Prices are updated twice a year with Statistics Sweden’s price index. Everything is in the app – nothing is fetched from shops.',
        'Using the app on several devices: update them all, or an older version may turn Food cost off again.',
      ],
    },
  },
  {
    version: '1.3.0',
    date: '2026-10-13',
    notes: {
      sv: [
        'Inköpslistan fylls på med det du ätit de senaste 7 dagarna.',
        'Skriv jämförpriset från hyllkanten så räknar listan ut ungefär vad det kostar – och visar de största posterna först.',
        'Tryck på en butik för att kolla erbjudanden på de dyraste varorna (Willys, ICA, Coop, Lidl, Hemköp, City Gross).',
        'Den här rutan: nyheter visas en gång när appen har uppdaterats.',
      ],
      en: [
        'The shopping list restocks from what you ate in the last 7 days.',
        'Type the unit price from the shelf and the list estimates the cost – with the biggest items first.',
        'Tap a store to check offers on the most expensive items (Willys, ICA, Coop, Lidl, Hemköp, City Gross).',
        'This box: what’s new is shown once after the app has been updated.',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2026-10-11',
    notes: {
      sv: [
        'Nytt utseende: Natt (Hologram) och Dag – välj i Inställningar → Utseende.',
        'Inköpslista från sparade måltider, recept och egna varor.',
        'Valbart: veckans avstämning, förslag på livsmedel och byten, och anpassad energiförbrukning.',
        'Sparade måltider, ”Som vanligt” och ”Samma som igår” gör det snabbare att logga.',
      ],
      en: [
        'A new look: Night (Hologram) and Day – choose in Settings → Appearance.',
        'A shopping list from saved meals, recipes and your own items.',
        'Optional: a weekly check-in, food suggestions and swaps, and adaptive energy expenditure.',
        'Saved meals, “The usual” and “Same as yesterday” make logging faster.',
      ],
    },
  },
];

/** Releases newer than `since` (newest first, at most `n`); the latest ones when there are none. */
export function releasesSince(since: string | null, n = 3): Release[] {
  const newer = since ? RELEASES.filter((r) => compareVersions(r.version, since) > 0) : [];
  return (newer.length ? newer : RELEASES).slice(0, n); // never an empty sheet
}
