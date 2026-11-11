// Fruit, vegetables & berries per 100 g of a food (M52), for the food-based goal of ≥ 500 g a day.
// What counts follows Livsmedelsverket's "grönsaker, frukt och bär": fresh, frozen, canned and dried
// fruit, berries, vegetables, root vegetables and mushrooms count; potatoes don't, and neither do
// legumes (beans, lentils, peas: their own advice), juice, jam or nuts. Amounts are as eaten.

/**
 * Livsmedelsverket's raw commodities (data/raw/prices/slv-ravaror.json, M34) that count. A food's
 * value is the sum of their shares (% of its weight), so a stew counts its vegetables.
 */
export const SLV_FRUIT_VEG = new Set([
  // Fruit
  'Ananas', 'Apelsin', 'Aprikos', 'Avokado', 'Banan', 'Carambole stjärnfrukt', 'Cherimoya', 'Citron', 'Dadlar',
  'Exotisk frukt,liten, icke ätbart skal', 'Fikon', 'Granatäpple', 'Grapefrukt', 'Guava', 'Kiwi', 'Kumquat',
  'Kvitten', 'Körsbär', 'Lime', 'Litchi', 'Mandarin', 'Mango', 'Matbanan', 'Melon', 'melon, vattenmelon',
  'Nektarin', 'Papaya', 'Passionsfrukt', 'Persika', 'Physalis', 'Plommon', 'Päron', 'Päron, torkade', 'Sharon',
  'Vindruvor', 'Äpple',
  // Berries
  'Aronia, torkad', 'Aroniabär', 'Björnbär', 'Björnbär, torkad', 'Blåbär', 'Blåbär, torkad', 'Bär', 'Fläderbär',
  'Gojibär', 'Hallon', 'Havtorn', 'Hjortron', 'Jordgubbar', 'Krusbär', 'Lingon', 'Lingon, torkad', 'Mullbär',
  'Nypon', 'Odon', 'Röda vinbär', 'Rönnbär', 'Svarta vinbär', 'Tranbär', 'Tranbär, torkad',
  // Vegetables, root vegetables (not potatoes), mushrooms, fresh herbs
  'Aubergine', 'Bambuskott', 'Basilika', 'Blomkål', 'Broccoli', 'Brysselkål', 'Bönor med balja', 'Champinjon',
  'Chilipeppar', 'Dill', 'Fänkål', 'Groddar', 'Groddar mungböna', 'Gräslök', 'Grönkål', 'Gurka', 'Jordärtskocka',
  'Kantareller', 'Koriander', 'Kronärtskocka', 'Kålrabbi', 'Kålrot', 'Lök (gul, röd)', 'Majrova', 'Majs',
  'Mangold', 'Morot', 'Mynta', 'Okra', 'Pak choi', 'Palsternacka', 'Paprika', 'Persilja', 'Pumpa', 'Purjolök',
  'Rabarber', 'Rotpersilja', 'Rotselleri', 'Rädisa', 'Rättika', 'Rödbeta', 'Rödkål', 'Sallad', 'Salladskål',
  'Savojkål', 'Sparris', 'Spenat', 'Squash', 'Stjälkselleri', 'Svamp, odlad', 'Svamp, vild', 'Svartrot',
  'Sötpotatis', 'Tomat', 'Tomat krossad', 'Trädgårdskrasse', 'Vattenkastanj', 'Vinblad', 'Vitkål', 'Vitlök',
  'Ärter med skida',
]);

/** Food groups (EuroFIR, facet A) whose fruit doesn't count: juice, jam and sweet drinks. */
const SLV_NOT = new Set([
  'Juice och nektar', 'Sylt eller marmelad', 'Dryck utan alkohol', 'Smaksättare, tex ketchup, sojasås, senap',
  'Kryddning eller extrakt', 'Krydda', 'Kryddor smaksättare dressing röror',
]);
/**
 * Concentrates, condiments, powders and fried snacks (M52b review): a spoonful of tomato paste is not
 * 100 g of vegetables. Sauces and dishes still count the vegetables in them.
 */
const SLV_NOT_NAME = /konc\.|relish|tacosås|pulver|chips/i;

/** g per 100 g, or null when the food has no breakdown. */
export function slvFruitVeg(info) {
  if (!info?.raw?.length) return null;
  if (SLV_NOT.has(info.group) || SLV_NOT_NAME.test(info.sv ?? '')) return 0;
  const share = info.raw.reduce((s, r) => s + (SLV_FRUIT_VEG.has(r[1]) ? r[3] : 0), 0);
  return Math.min(100, share);
}

/** USDA FoodData Central categories: 9 Fruits and Fruit Juices, 11 Vegetables and Vegetable Products. */
const USDA_FRUIT = '9';
const USDA_VEG = '11';
const USDA_NOT = /juice|nectar|drink|potato|french fr|dehydrated|powder|flakes|seaweed.*dry|catsup|ketchup|paste|pur[eé]e|sauce|pickle|relish|chutney|onion rings|breaded|chips/i;

/** g per 100 g: the whole food when it is a fruit or vegetable (not juice or potatoes), else 0. */
export function usdaFruitVeg(categoryId, name) {
  if ((categoryId === USDA_FRUIT || categoryId === USDA_VEG) && !USDA_NOT.test(name)) return 100;
  return 0;
}
