// Swedish strings for the Open Food Facts upload screen, kept out of the first bundle (this module
// loads only with that lazy screen). Other languages keep theirs in their pack (`off` in lang/*.ts).
import { lang, packOf } from './i18n';

const sv = {
  offUploadTitle: 'Lägg till på Open Food Facts',
  offBrand: 'Varumärke',
  offPhotos: 'Bilder (rekommenderas)',
  offPhotoFront: 'Framsidan',
  offPhotoNutrition: 'Näringstabellen',
  offAccount: 'Ditt konto på Open Food Facts',
  offUser: 'Användarnamn',
  offPassword: 'Lösenord',
  offLoginNote: 'Lösenordet används bara för den här uppladdningen och sparas aldrig.',
  offCreateAccount: 'Skapa ett konto (gratis)',
  offPublishNote: 'Uppgifterna och bilderna publiceras öppet på Open Food Facts (ODbL / CC BY-SA) så att alla kan använda dem.',
  offUploadSend: 'Skicka och lägg till',
  offUploading: 'Skickar…',
  offUploadLogin: 'Fel användarnamn eller lösenord för Open Food Facts.',
  offUploadNetwork: 'Ingen kontakt med Open Food Facts. Kontrollera anslutningen och försök igen.',
  offUploadRejected: 'Open Food Facts tog inte emot produkten. Kontrollera uppgifterna eller gör det på webbplatsen.',
  offUploadInvalid: 'Ett av näringsvärdena är inget giltigt tal.',
  offContinue: 'Fortsätt',
  offPhotosFailed: 'Produkten är tillagd, men {n} bild(er) kom inte fram. Du kan lägga till dem på Open Food Facts webbplats.',
  offCheckKcal: 'Energin verkar för hög (över 900 kcal per 100 g). Står värdet i kJ?',
  offCheckSum: 'Fett, kolhydrater, protein, fibrer och salt blir tillsammans mer än 100 g – kontrollera decimalerna.',
  offCheckParts: 'Sockerarter kan inte vara mer än kolhydraterna, och mättat fett inte mer än fettet.',
  offCheckMacros: 'Inget näringsämne kan vara mer än 100 g per 100 g – kontrollera decimalerna.',
  offMissingLogin: 'Fyll i ditt användarnamn och lösenord för Open Food Facts.',
  offMissingKcal: 'Fyll i energin (kcal per 100 g) från etiketten.',
  offMissingName: 'Fyll i produktens namn.',
};

export type OffKey = keyof typeof sv;

export const to = (key: OffKey): string => packOf(lang.value)?.off?.[key] ?? packOf('en')?.off?.[key] ?? sv[key];
