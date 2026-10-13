// Swedish strings for the shopping list (M28), kept out of the first bundle: this module loads only
// with the shopping sheet. Other languages keep theirs in their pack (`shop` in lang/*.ts).
import { lang, packOf } from './i18n';

export const SV_SHOP = {
  shopEmpty: 'Listan är tom. Lägg till sparade måltider, recept eller det du planerat i dagboken.',
  shopAddTitle: 'Lägg till i listan',
  shopPlanned: 'Planerat i dagboken, kommande 7 dagar',
  shopPlannedCount: '{n} livsmedel',
  shopSavedMeals: 'Sparade måltider',
  shopRecipes: 'Recept (hela receptet)',
  shopAdd: 'Lägg till',
  shopAdded: 'Tillagt i listan.',
  shopOwnItem: 'Egen vara',
  shopOwnPlaceholder: 't.ex. tandkräm',
  shopShare: 'Dela listan',
  shopCopied: 'Listan är kopierad.',
  shopClearChecked: 'Ta bort avbockade',
  shopClearAll: 'Töm listan',
  shopClearAllConfirm: 'Ta bort allt från inköpslistan?',
  shopFull: 'Listan är full ({n} rader). Ta bort avbockade först.',
  shopSaveFailed: 'Kunde inte spara. Försök igen.',
  shopLastWeek: 'Det du åt de senaste 7 dagarna',
  shopNoLastWeek: 'Inget loggat de senaste 7 dagarna.',
  shopView: 'Visa',
  shopViewSections: 'Avdelning',
  shopViewCost: 'Största posterna',
  shopTotal: 'Uppskattat totalt: ~{kr} kr',
  shopNoPrice: '{n} utan pris',
  shopCostNote: 'Kostnaden räknas på mängden på listan.',
  shopPrice: 'Pris',
  shopPriceLabel: 'Jämförpris',
  shopPriceHint: 'Står på hyllkanten, t.ex. 21,33 kr/kg.',
  shopPriceItem: 'Pris (kr)',
  shopSavePrice: 'Spara pris',
  shopOffers: 'Kolla erbjudanden:',
  shopMyStores: 'Mina butiker',
  shopOffersNote: 'Länkarna öppnar butikens webbplats med varans namn eller text i sökningen. Appen hämtar inget själv.',
  shopNoStores: 'Välj minst en butik för att få länkar.',
  shopClearPrice: 'Ta bort pris',
  secProduce: 'Frukt & grönt',
  secBread: 'Bröd, gryn & pasta',
  secDairy: 'Mejeri & ägg',
  secMeat: 'Kött & fisk',
  secDry: 'Skafferi',
  secFrozen: 'Frys',
  secOther: 'Övrigt',
};

export type ShopKey = keyof typeof SV_SHOP;

// Swedish strings live here; other languages in their pack, falling back to English.
export const tsh = (key: ShopKey): string =>
  lang.value === 'sv' ? SV_SHOP[key] : (packOf(lang.value)?.shop?.[key] ?? packOf('en')?.shop?.[key] ?? SV_SHOP[key]);
