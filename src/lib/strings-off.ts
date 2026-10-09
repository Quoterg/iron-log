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
  offLoginNote: 'Används bara för den här uppladdningen och sparas aldrig på enheten.',
  offCreateAccount: 'Skapa ett konto (gratis)',
  offPublishNote: 'Uppgifterna och bilderna publiceras öppet på Open Food Facts (ODbL / CC BY-SA) så att alla kan använda dem.',
  offUploadSend: 'Skicka och lägg till',
  offUploading: 'Skickar…',
  offUploadLogin: 'Fel användarnamn eller lösenord för Open Food Facts.',
  offUploadNetwork: 'Ingen kontakt med Open Food Facts. Kontrollera anslutningen och försök igen.',
  offUploadRejected: 'Open Food Facts tog inte emot produkten. Kontrollera uppgifterna eller gör det på webbplatsen.',
  offUploadInvalid: 'Fyll i namn, energi (kcal), användarnamn och lösenord – och bara giltiga tal.',
};

export type OffKey = keyof typeof sv;

export const to = (key: OffKey): string => packOf(lang.value)?.off?.[key] ?? packOf('en')?.off?.[key] ?? sv[key];
