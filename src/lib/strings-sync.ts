// Swedish strings for the sync screens (Settings card and sync sheet), kept out of the first bundle:
// this module loads only with those lazy screens. Other languages keep theirs in their pack
// (`sync` in lang/*.ts), so nobody downloads languages they don't use.
import { lang, packOf } from './i18n';

const sv = {
  syncTitle: 'Synka med en annan enhet',
  syncCardIntro: 'Kopiera din dagbok och dina inställningar direkt mellan två av dina enheter – utan konto eller server.',
  syncStart: 'Synka',
  syncIntro: 'Öppna Iron Log på båda enheterna, på samma wifi. Starta på den ena enheten och skanna koden med den andra.',
  syncPrivacy: 'Enheterna kopplas ihop direkt och krypterat. Inget skickas till någon server.',
  syncShowCode: 'Starta här (visa kod)',
  syncScanCode: 'Skanna kod',
  syncPreparing: 'Förbereder…',
  syncOfferHint: 'Skanna den här koden med den andra enheten (Inställningar → Synka → Skanna kod).',
  syncThenScanAnswer: 'Skanna sedan svaret från den andra enheten',
  syncScanOfferHint: 'Skanna koden som visas på den andra enheten.',
  syncAnswerHint: 'Skanna den här koden med den första enheten.',
  syncWaiting: 'Väntar på den andra enheten…',
  syncRunning: 'Synkar…',
  syncApplying: 'Sparar ändringarna…',
  syncDone: 'Klart! {in} ändringar hämtade, {out} skickade.',
  syncErrorCode: 'Koden kunde inte läsas. Se till att du skannar koden från Iron Log och försök igen.',
  syncErrorVersion: 'Enheterna har olika versioner av Iron Log. Ladda om appen på båda och försök igen.',
  syncErrorConnect: 'Enheterna fick ingen kontakt. Kontrollera att båda är på samma wifi (inte gästnätverk) och försök igen.',
  syncErrorOther: 'Synkningen misslyckades. Försök igen.',
  syncErrorPartial: 'Anslutningen bröts. En del ändringar hann sparas – synka igen för att få med resten.',
  syncShowSaved: 'Visa det som sparats',
  syncProgress: 'Sparar ändringar… {done} av {total}',
  syncQrLabel: 'QR-kod för att koppla ihop enheterna',
  syncAsText: 'Visa som text',
  syncScanHint: 'Rikta kameran mot QR-koden.',
  syncNoCamera: 'Kameran är inte tillgänglig. Klistra in koden nedan.',
  syncPasteLabel: 'Eller klistra in koden',
  syncUseCode: 'Använd koden',
  copied: 'Kopierad',
};

export type SyncKey = keyof typeof sv;

// Swedish strings live here; other languages in their pack, falling back to English.
export const ts = (key: SyncKey): string =>
  lang.value === 'sv' ? sv[key] : (packOf(lang.value)?.sync?.[key] ?? packOf('en')?.sync?.[key] ?? sv[key]);
