// Fresh fruits for "Frukt i säsong" (M40): which statistics describe each one. The seasons are not
// written here — build-fruit.mjs computes them from the data (fetch-fruit.mjs):
//   cn       SCB's monthly imports by product code (KN, 6 digits: stable across the yearly code changes)
//   food     the Livsmedelsverket food whose nutrients a portion has (raw, fresh)
//   unit     a household portion: [measure, grams] (st = one fruit, edible part; dl = in pieces —
//            measures that read right in any number: "3 dl", never "3 skiva")
//   se       Swedish production (Jordbruksverket): `harvest` = [table, crop] of the yearly harvest in
//            tonnes; `price` = the product in the monthly producer prices (JO1001L2) — a month with a
//            price is a month Swedish growers sold it. Pears have no monthly price: `like` borrows
//            the apple months (both are stored pome fruit).
export const FRUITS = [
  { key: 'apple', sv: 'Äpple', en: 'Apple', cn: ['080810'], food: 'slv:588', unit: ['st', 150], se: { harvest: ['JO0102R21', 'Äpple'], price: '21' } },
  { key: 'pear', sv: 'Päron', en: 'Pear', cn: ['080830'], food: 'slv:583', unit: ['st', 160], se: { harvest: ['JO0102R21', 'Päron'], like: 'apple' } },
  { key: 'strawberries', sv: 'Jordgubbar', en: 'Strawberries', cn: ['081010'], food: 'slv:526', unit: ['dl', 65], se: { harvest: ['JO0102R11', 'Jordgubbar'], price: '22' } },
  { key: 'orange', sv: 'Apelsin', en: 'Orange', cn: ['080510'], food: 'slv:551', unit: ['st', 140] },
  { key: 'clementine', sv: 'Clementin', en: 'Clementine', cn: ['080521', '080522', '080529'], food: 'slv:560', unit: ['st', 60] },
  { key: 'grapefruit', sv: 'Grapefrukt', en: 'Grapefruit', cn: ['080540'], food: 'slv:521', unit: ['st', 250] },
  { key: 'banana', sv: 'Banan', en: 'Banana', cn: ['080390'], food: 'slv:553', unit: ['st', 120] },
  { key: 'kiwi', sv: 'Kiwi', en: 'Kiwi', cn: ['081050'], food: 'slv:565', unit: ['st', 75] },
  { key: 'pineapple', sv: 'Ananas', en: 'Pineapple', cn: ['080430'], food: 'slv:550', unit: ['dl', 70] },
  { key: 'mango', sv: 'Mango', en: 'Mango', cn: ['080450'], food: 'slv:574', unit: ['st', 200] },
  { key: 'avocado', sv: 'Avokado', en: 'Avocado', cn: ['080440'], food: 'slv:320', unit: ['st', 140] },
  { key: 'grapes', sv: 'Vindruvor', en: 'Grapes', cn: ['080610'], food: 'slv:587', unit: ['dl', 70] },
  { key: 'watermelon', sv: 'Vattenmelon', en: 'Watermelon', cn: ['080711'], food: 'slv:549', unit: ['dl', 65] },
  { key: 'melon', sv: 'Melon', en: 'Melon', cn: ['080719'], food: 'slv:546', unit: ['dl', 65] },
  { key: 'papaya', sv: 'Papaya', en: 'Papaya', cn: ['080720'], food: 'slv:577', unit: ['dl', 60] },
  { key: 'apricot', sv: 'Aprikos', en: 'Apricot', cn: ['080910'], food: 'slv:552', unit: ['st', 40] },
  { key: 'cherries', sv: 'Körsbär', en: 'Cherries', cn: ['080921', '080929'], food: 'slv:571', unit: ['dl', 70] },
  { key: 'peach', sv: 'Persika/nektarin', en: 'Peach/nectarine', cn: ['080930'], food: 'slv:580', unit: ['st', 130] },
  { key: 'plum', sv: 'Plommon', en: 'Plum', cn: ['080940'], food: 'slv:582', unit: ['st', 55] },
  { key: 'raspberries', sv: 'Hallon', en: 'Raspberries', cn: ['081020'], food: 'slv:523', unit: ['dl', 60] },
  { key: 'currants', sv: 'Vinbär', en: 'Currants', cn: ['081030'], food: 'slv:586', unit: ['dl', 55] },
  { key: 'blueberries', sv: 'Blåbär', en: 'Blueberries', cn: ['081040'], food: 'slv:7042', unit: ['dl', 60] },
  { key: 'persimmon', sv: 'Sharon/persimon', en: 'Persimmon', cn: ['081070'], food: 'slv:581', unit: ['st', 170] },
];

/**
 * European countries (ISO 3166 alpha-2) for "Sverige + Europa". SCB records EU imports by the
 * country that sent them, so fruit re-sent via e.g. the Netherlands counts as from there.
 */
export const EUROPE = new Set(
  'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GI GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK'.split(' '),
);
