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
      da: [
        'Madudgifter (valgfrit): omtrentlige priser for over 2.300 fødevarer – i dagbogen pr. fødevare, måltid og dag og på indkøbslisten. Slå til under Indstillinger → Madudgifter.',
        'Tryk på en udgift i dagbogen for at skrive din egen pris; den bruges også på indkøbslisten.',
        'Priserne opdateres to gange om året med SCB’s prisindeks. Alt ligger i appen – intet hentes fra butikker.',
        'Bruger du appen på flere enheder: opdater dem alle, ellers kan en ældre version slå Madudgifter fra igen.',
      ],
      de: [
        'Lebensmittelkosten (optional): ungefähre Preise für über 2.300 Lebensmittel – im Tagebuch pro Lebensmittel, Mahlzeit und Tag und auf der Einkaufsliste. Einschalten unter Einstellungen → Lebensmittelkosten.',
        'Tippe im Tagebuch auf einen Betrag, um deinen eigenen Preis einzugeben; er gilt auch auf der Einkaufsliste.',
        'Die Preise werden zweimal im Jahr mit dem Preisindex von SCB aktualisiert. Alles steckt in der App – nichts wird von Läden abgerufen.',
        'Nutzt du die App auf mehreren Geräten: aktualisiere alle, sonst kann eine ältere Version Lebensmittelkosten wieder ausschalten.',
      ],
      fi: [
        'Ruokakulut (valinnainen): likimääräiset hinnat yli 2 300 elintarvikkeelle – päiväkirjassa elintarvikkeittain, aterioittain ja päivittäin sekä ostoslistalla. Ota käyttöön kohdassa Asetukset → Ruokakulut.',
        'Napauta päiväkirjassa hintaa kirjoittaaksesi oman hintasi; sitä käytetään myös ostoslistalla.',
        'Hinnat päivitetään kahdesti vuodessa SCB:n hintaindeksillä. Kaikki on sovelluksessa – kaupoista ei haeta mitään.',
        'Jos käytät sovellusta useilla laitteilla: päivitä kaikki, muuten vanhempi versio voi kytkeä Ruokakulut taas pois.',
      ],
      so: [
        'Kharashka cuntada (ikhtiyaari): qiimayaal qiyaas ah oo loogu talagalay in ka badan 2,300 cunto – buugga maalinlaha cunto kasta, cunto-qayb kasta iyo maalin kasta, iyo liiska iibsiga. Ka shid Dejinta → Kharashka cuntada.',
        'Riix kharash ku jira buugga maalinlaha si aad u qorto qiimahaaga; sidoo kale waxaa lagu isticmaalaa liiska iibsiga.',
        'Qiimayaasha waxaa la cusboonaysiiyaa laba jeer sannadkii iyadoo la adeegsanayo tusaha qiimaha SCB. Wax walba waxay ku jiraan barnaamijka – dukaamada waxba lagama soo dejiyo.',
        'Haddii aad barnaamijka ku isticmaasho qalab badan: cusboonaysii dhammaan, haddii kale nooc hore ayaa mar kale demin kara Kharashka cuntada.',
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
      da: [
        'Indkøbslisten fyldes op med det, du har spist de seneste 7 dage.',
        'Skriv sammenligningsprisen fra hyldekanten, så regner listen omtrent ud, hvad det koster – med de største poster først.',
        'Tryk på en butik for at se tilbud på de dyreste varer (Willys, ICA, Coop, Lidl, Hemköp, City Gross).',
        'Denne boks: nyheder vises én gang, når appen er blevet opdateret.',
      ],
      de: [
        'Die Einkaufsliste füllt sich mit dem, was du in den letzten 7 Tagen gegessen hast.',
        'Gib den Grundpreis vom Regal ein, und die Liste schätzt die Kosten – mit den größten Posten zuerst.',
        'Tippe auf einen Laden, um Angebote für die teuersten Artikel zu sehen (Willys, ICA, Coop, Lidl, Hemköp, City Gross).',
        'Dieses Fenster: Neuigkeiten erscheinen einmal nach einem Update der App.',
      ],
      fi: [
        'Ostoslista täydentyy sillä, mitä söit viimeisten 7 päivän aikana.',
        'Kirjoita hyllyn vertailuhinta, niin lista arvioi kustannukset – suurimmat erät ensin.',
        'Napauta kauppaa nähdäksesi tarjoukset kalleimmista tuotteista (Willys, ICA, Coop, Lidl, Hemköp, City Gross).',
        'Tämä ikkuna: uutuudet näytetään kerran sovelluksen päivityksen jälkeen.',
      ],
      so: [
        'Liiska iibsiga waxaa lagu buuxiyaa waxaad cuntay 7-dii maalmood ee la soo dhaafay.',
        'Qor qiimaha isbarbardhigga ee khaanadda, liiskuna wuxuu qiyaasayaa kharashka – kuwa ugu waaweyn marka hore.',
        'Riix dukaan si aad u aragto dalacsiinta alaabta ugu qaalisan (Willys, ICA, Coop, Lidl, Hemköp, City Gross).',
        'Sanduuqan: waxa cusub waxaa la muujiyaa hal mar marka barnaamijka la cusboonaysiiyo.',
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
      da: [
        'Nyt udseende: Nat (Hologram) og Dag – vælg i Indstillinger → Udseende.',
        'Indkøbsliste fra gemte måltider, opskrifter og egne varer.',
        'Valgfrit: ugens status, forslag til fødevarer og bytte, og tilpasset energiforbrug.',
        'Gemte måltider, ”Som sædvanligt” og ”Samme som i går” gør det hurtigere at logge.',
      ],
      de: [
        'Neues Aussehen: Nacht (Hologram) und Tag – wähle unter Einstellungen → Erscheinungsbild.',
        'Eine Einkaufsliste aus gespeicherten Mahlzeiten, Rezepten und eigenen Artikeln.',
        'Optional: ein Wochenrückblick, Vorschläge für Lebensmittel und Tausch, und ein adaptiver Energieverbrauch.',
        'Gespeicherte Mahlzeiten, „Wie üblich“ und „Wie gestern“ machen das Eintragen schneller.',
      ],
      fi: [
        'Uusi ulkoasu: Yö (Hologram) ja Päivä – valitse kohdasta Asetukset → Ulkoasu.',
        'Ostoslista tallennetuista aterioista, resepteistä ja omista tuotteista.',
        'Valinnaisesti: viikon katsaus, elintarvike- ja vaihtoehdotukset sekä mukautuva energiankulutus.',
        'Tallennetut ateriat, ”Kuten tavallisesti” ja ”Sama kuin eilen” nopeuttavat kirjaamista.',
      ],
      so: [
        'Muuqaal cusub: Habeen (Hologram) iyo Maalin – ka dooro Dejinta → Muuqaal.',
        'Liiska iibsiga oo laga sameeyo cuntooyin la kaydiyey, cunto-karis iyo alaabtaada.',
        'Ikhtiyaari: dib-u-eegista toddobaadka, soo jeedin cunto iyo beddel, iyo tamarta la qabsata.',
        'Cuntooyinka la kaydiyey, ”Sidii caadada” iyo ”Sidii shalay” ayaa qoritaanka dedejiya.',
      ],
    },
  },
];

/** Releases newer than `since` (newest first, at most `n`); the latest ones when there are none. */
export function releasesSince(since: string | null, n = 3): Release[] {
  const newer = since ? RELEASES.filter((r) => compareVersions(r.version, since) > 0) : [];
  return (newer.length ? newer : RELEASES).slice(0, n); // never an empty sheet
}
