// Swedish strings for the shopping list (M28), kept out of the first bundle: this module loads only
// with the shopping sheet. Other languages keep theirs in their pack (`shop` in lang/*.ts).
import { lang, packOf } from './i18n';

export const SV_SHOP = {
  shopEmpty: 'Listan är tom. Lägg till sparade måltider, recept eller det du planerat i dagboken.',
  shopAddTitle: 'Lägg till i listan',
  shopPlanned: 'Planerat i dagboken, kommande 7 dagar',
  shopPlannedCount: '{n} livsmedel',
  shopNoPlanned: 'Inget planerat de kommande 7 dagarna. Kopiera en dag eller måltid framåt i dagboken, så kan du lägga till den här.',
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
