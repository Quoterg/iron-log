// The hand-made part of the typical-price table (M33). Each item is one shelf price:
// - q, re, not: the search(es) on willys.se that compile-base-prices.mjs runs once a year (owner's
//   choice: comparison prices of one store on one date, re-checked yearly); `re`/`not` filter the
//   product names found. `pieceG` converts kr/st (eggs, tea bags); `density` kr/l → kr/kg (default 1).
// - factors: [name pattern, multiplier] for foods priced at another strength than the shelf price
//   (brewed coffee from ground coffee, concentrated saft from ready-to-drink).
// - scb: the SCB consumer-price-index group that moves the price between re-checks (CC0).
// - com: Livsmedelsverket raw commodities it prices (for dishes summed from their ingredients).
// - slv: Livsmedelsverket foods it prices directly, as bought.
// - raw: the shelf price is for the raw food (meat, pasta, rice, vegetables): cooked foods of the
//   family are priced by the raw weight in them (cooked pasta: 50 g dry per 100 g → half).
// - off: Open Food Facts categories whose Open Prices replace the shelf price when there are enough.
// Order matters: the first `slv` match wins, so specific families come before general ones.

/** @typedef {{ key: string, q: string | string[], re?: RegExp, not?: RegExp, pieceG?: number, density?: number, scb: string, com?: string[], slv?: RegExp, raw?: boolean, factors?: [RegExp, number][], off?: string[] }} PriceItem */

/** @type {PriceItem[]} */
export const ITEMS = [
  // --- Dairy
  { key: 'mellanmjolk', q: 'mellanmjölk', re: /mellanmjölk/i, not: /laktosfri|choklad|jordgubb/i, scb: '01.1.4.3', com: ['Mjölk fett 1-2,5 %'], slv: /^Mellanmjölk|^Mjölkdryck/, off: ['en:semi-skimmed-milks'] },
  { key: 'standardmjolk', q: 'standardmjölk', re: /mjölk/i, not: /laktosfri|choklad|havre|soja/i, scb: '01.1.4.3', com: ['Mjölk fett > 2,5%'], slv: /^Mjölk fett/, off: ['en:whole-milks'] },
  { key: 'mjolkpulver', q: 'mjölkpulver', re: /mjölkpulver|torrmjölk/i, scb: '01.1.4.3', com: ['Mjölkpulver', 'Mjölk kondenserad', 'Vasslepulver', 'Vassle', 'Mjölkprotein', 'Laktos', 'Vassleprotein'], slv: /^(Mjölkpulver|Kondenserad mjölk)/ },
  { key: 'lattmjolk', q: 'lättmjölk', re: /lättmjölk|minimjölk/i, not: /laktosfri/i, scb: '01.1.4.2', com: ['Mjölk fett < 1 %'], slv: /^(Lättmjölk|Minimjölk)/ },
  { key: 'filmjolk', q: 'filmjölk', re: /fil/i, not: /smak|jordgubb|vanilj|blåbär|päron|hallon|mango/i, scb: '01.1.4.6', com: ['Filmjölk fett >2,5 %', 'Filmjölk fett 1-2,5 %', 'Kärnmjölk'], slv: /^(Filmjölk|Lättfil|Mellanfil|Filbunke|Kefir)/ },
  { key: 'yoghurt', q: 'yoghurt naturell', re: /yoghurt/i, not: /grekisk|turkisk|smak|vanilj/i, scb: '01.1.4.6', com: ['Yoghurt fett > 3%', 'Yoghurt fett 1-2,5 %', 'Yoghurt fett <1 %'], slv: /^Yoghurt naturell|^Yoghurtdryck/ },
  { key: 'yoghurt-smak', q: ['yoghurt jordgubb', 'yoghurt vanilj', 'yoghurt blåbär'], re: /yoghurt/i, not: /grekisk|turkisk|drick|kvarg|frystorkad|månader|mini|safari/i, scb: '01.1.4.6', slv: /^(Fruktyoghurt|Yoghurt mild|Yoghurt smaksatt|Drickyoghurt)/ },
  { key: 'kvarg', q: 'kvarg', re: /kvarg/i, scb: '01.1.4.6', slv: /^Kvarg/ },
  { key: 'grekisk', q: 'turkisk yoghurt', re: /yoghurt/i, scb: '01.1.4.6', slv: /^Yoghurt naturell fett 10%/ },
  { key: 'vispgradde', q: 'vispgrädde', re: /vispgrädde/i, not: /ersätt|vegan|havre|laktosfri/i, scb: '01.1.4.3', com: ['Grädde fett >31%', 'Grädde'], slv: /^(Vispgrädde fett|Mellangrädde)/ },
  { key: 'matlagningsgradde', q: 'matlagningsgrädde', re: /grädde/i, not: /havre|soja|vegan|laktosfri/i, scb: '01.1.4.3', com: ['Grädde fett <15%', 'Grädde fett 16-30%'], slv: /^(Matlagningsgrädde|Kaffegrädde fett)/ },
  { key: 'cremefraiche', q: 'crème fraiche', re: /fra[iî]che/i, not: /havre|vegan|smak|örter|vitlök|chili/i, scb: '01.1.4.3', com: ['Créme fraiche'], slv: /^(Crème fraiche|Mini fraiche)/ },
  { key: 'graddfil', q: 'gräddfil', re: /gräddfil/i, scb: '01.1.4.3', com: ['Gräddfil'], slv: /^Gräddfil fett/ },
  { key: 'hardost', q: 'hushållsost', re: /ost/i, not: /riven|skivad|tärnad|smak/i, scb: '01.1.4.5', com: ['Ost (hårdost)', 'Ost'], slv: /^Ost hårdost fett|^Ost hårdost eko|^Ostkräm/ },
  { key: 'parmesan', q: 'parmesan', re: /parm|grana/i, not: /riven/i, scb: '01.1.4.5', com: ['Ost, Extra hårdost ex parmesan'], slv: /^Ost hårdost parmesan/ },
  { key: 'farskost', q: 'färskost naturell', re: /färskost|philadelphia|cream cheese/i, not: /smak|vitlök|örter|chili/i, scb: '01.1.4.5', com: ['Ost, Färskost'], slv: /^Färskost (cream cheese|fett|m\. vitlök)/ },
  { key: 'keso', q: 'keso cottage cheese', re: /cottage|keso/i, scb: '01.1.4.5', slv: /^Färskost cottage/ },
  { key: 'ricotta', q: 'ricotta', re: /ricotta/i, scb: '01.1.4.5', slv: /^Färskost ricotta|^Paneer/ },
  { key: 'mozzarella', q: 'mozzarella', re: /mozzarella/i, not: /riven/i, scb: '01.1.4.5', slv: /^Ost mozzarella/ },
  { key: 'halloumi', q: 'halloumi', re: /halloumi/i, scb: '01.1.4.5', slv: /^Ost halloumi/ },
  { key: 'fetaost', q: 'fetaost', re: /feta|salladsost/i, scb: '01.1.4.5', com: ['Ost, salladsost'], slv: /^Salladsost/ },
  { key: 'mjukost', q: 'mjukost', re: /mjukost|smältost/i, scb: '01.1.4.5', com: ['Ost, mjukost'], slv: /^Mjukost/ },
  { key: 'brie', q: 'brie', re: /brie|camembert/i, scb: '01.1.4.5', slv: /^Vitmögelost (brie|camembert|smaksatt)/ },
  { key: 'chevre', q: 'chèvre', re: /ch[eè]vre|getost/i, scb: '01.1.4.5', slv: /^Vitmögelost getost/ },
  { key: 'adelost', q: ['ädelost', 'gorgonzola', 'grönmögelost'], re: /ädelost|gorgonzola|grönmögel|blåmögel/i, scb: '01.1.4.5', slv: /^Ädelost/ },
  { key: 'mesost', q: 'messmör', re: /mes/i, scb: '01.1.4.5', slv: /^(Mesost|Messmör)/ },
  { key: 'smor', q: 'smör normalsaltat', re: /smör/i, not: /bregott|olja|lätt|vegan|ghee|kakao|jordnöt|mandel/i, scb: '01.1.5.2', com: ['Smör', 'Fett mjölkfett'], slv: /^(Smör (fett|extrasaltat|osaltat)|Klarnat smör)/ },
  { key: 'bregott', q: 'bregott', re: /bregott|smör.*raps|matfett/i, scb: '01.1.5.2', com: ['Fett matfettsblandning'], slv: /^(Matfettsblandning|Flytande matfettsblandning|Lättsmör)/ },
  { key: 'margarin', q: 'margarin', re: /margarin|flora|becel|lätta|milda|melba|carlshamn/i, scb: '01.1.5.3', slv: /^(Bordsmargarin|Hushållsmargarin|Lättmargarin|Flytande margarin)/ },
  { key: 'agg', q: 'ägg 12-p', re: /ägg/i, not: /nudlar|pasta|röra|kokt/i, pieceG: 60, raw: true, scb: '01.1.4.8', com: ['Ägg, höna', 'Äggula', 'Äggvita'], slv: /^Ägg (rått|kokt|stekt)|^Äggula|^Äggvita/ },

  // --- Plant-based dairy
  { key: 'havredryck', q: 'havredryck', re: /havre/i, not: /choklad|barista|kaffe/i, scb: '01.1.4.4', slv: /^Havredryck fett/, off: ['en:oat-based-drinks'] },
  { key: 'havredryck-choklad', q: 'havredryck choklad', re: /choklad/i, scb: '01.1.4.4', slv: /^Havredryck choklad|^Chokladdryck (drickf|m\. vatten)/ },
  { key: 'sojadryck', q: 'sojadryck', re: /soja/i, not: /choklad|vanilj/i, scb: '01.1.4.4', slv: /^Sojadryck/ },
  { key: 'mandeldryck', q: 'mandeldryck', re: /mandel/i, scb: '01.1.4.4', slv: /^(Mandeldryck|Kokosnötdryck|Sesamdryck)/ },
  { key: 'havregurt', q: ['havregurt', 'oatgurt', 'soygurt', 'växtbaserad yoghurt'], re: /gurt|havre|soja|växtbaserad/i, not: /dryck/i, scb: '01.1.4.4', slv: /^(Havregurt|Soygurt)/ },
  { key: 'havrefraiche', q: ['havrebaserad crème fraiche', 'havregrädde', 'ikaffe', 'sojagrädde'], re: /havre|oat|soja|ikaffe|planti|vego/i, scb: '01.1.4.4', slv: /^(Fraiche m\. havre|Matlagningsbas m\. (havre|soja))/ },
  { key: 'tofu', q: 'tofu', re: /tofu/i, not: /marinerad|smak|rökt/i, scb: '01.1.9.9', com: ['Sojaböna'], slv: /^(Tofu|Tempeh)/, off: ['en:plain-tofu', 'en:tofu'] },

  // --- Meat: beef
  { key: 'notfars', q: 'nötfärs', re: /nötfärs/i, not: /vilt|kyckling/i, raw: true, scb: '01.1.2.2', com: ['Nöt/ko', 'Nöt/Ko Inälvsmat/blod', 'Inälvsmat/blod'], slv: /^(Nöt färs|Hamburgare nöt rå|Nöt kött hackebiff)/ },
  { key: 'blandfars', q: 'blandfärs', re: /blandfärs/i, raw: true, scb: '01.1.2.2', slv: /^Blandfärs|^Färs stekt/ },
  { key: 'notgryt', q: 'högrev', re: /högrev|grytbitar|bog|bringa/i, not: /kalv|lamm|gris|fläsk/i, raw: true, scb: '01.1.2.2', slv: /^Nöt (grytbitar|högrev|bog|lägg|oxbringa|oxsvans|stek el\. grytstek|kött)/ },
  { key: 'notstek', q: ['rostbiff', 'nöt innanlår', 'fransyska'], re: /rostbiff|innanlår|fransyska|ytterlår/i, not: /lamm|hjort|deli|skivor|skivad|wrap|marinerad|kalv|gris/i, raw: true, scb: '01.1.2.2', slv: /^Nöt (innanlår|fransyska|rostbiff|ytterlår|flankstek|clubstek)|^Nöt rostbiff tillagad/ },
  { key: 'notdyr', q: 'ryggbiff', re: /ryggbiff|entrecote|entrecôte|oxfilé/i, raw: true, scb: '01.1.2.2', slv: /^Nöt (ryggbiff|entrecôte|oxfilé)/ },
  { key: 'kalv', q: 'kalvfärs', re: /kalv/i, raw: true, scb: '01.1.2.2', com: ['Kalv'], slv: /^Kalv /i },
  { key: 'lever', q: 'lever', re: /lever/i, not: /pastej|kyckling|korv/i, raw: true, scb: '01.1.2.4', com: ['Lever, nöt', 'Lever, gris', 'Lever, kyckling', 'Njure, nöt', 'Njure, gris', 'Njure, får', 'Fågel inälvsmat/blod'], slv: /lever (rå|stekt|tillagad|panerad)|^(Grislever|Lammlever|Renlever) stekt|^Leverbiff/i },
  // --- Pork
  { key: 'flaskfars', q: 'fläskfärs', re: /fläskfärs|griskött|färs gris/i, raw: true, scb: '01.1.2.2', slv: /^Gris färs/ },
  { key: 'flaskkarre', q: 'fläskkarré', re: /karré|kotlett|bog|grytbitar|kassler/i, not: /rökt pålägg|skivad pålägg/i, raw: true, scb: '01.1.2.2', com: ['Gris', 'Gris Inälvsmat/blod', 'Gris inälvsmat/blod'], slv: /^Gris (fläskkarré|fläskkotlett|bog|bogbladsstek|grytbitar|kött|picnicbog|lägg|fötter|fläskben|ytterfilé|kassler|skinka (fransyska|innanlår|ytterlår)|skinkstek|revbensspjäll|flintastek)|^Fläskkotlett/ },
  { key: 'flaskfile', q: 'fläskfilé', re: /fläskfilé|fläskytterfilé/i, raw: true, scb: '01.1.2.2', slv: /^Gris fläskfilé/ },
  { key: 'sidflask', q: 'sidfläsk', re: /sidfläsk|stekfläsk/i, raw: true, scb: '01.1.2.3', com: ['Fett ister och annat djurfett', 'Gris, rökt'], slv: /^Gris (sidfläsk|stekfläsk|ister|späck|svål)|^Rimmat sidfläsk/ },
  { key: 'bacon', q: 'bacon', re: /bacon/i, not: /chips|vegan|ost|dressing/i, raw: true, scb: '01.1.2.3', slv: /^Gris bacon/ },
  { key: 'skinka-palagg', q: 'skinka skivad', re: /skinka|kokt skinka|rökt skinka/i, not: /lufttorkad|serrano|parma/i, scb: '01.1.2.3', slv: /^Gris skinka (skivad|rökt|bog konserv|julskinka)|^Gris bog konserv|^Kalkon rökt/ },
  { key: 'lufttorkad', q: 'lufttorkad skinka', re: /lufttorkad|serrano|prosciutto|parma/i, scb: '01.1.2.3', slv: /^Gris skinka lufttorkad/ },
  // --- Lamb, game, other meat
  { key: 'lamm', q: 'lamm', re: /lamm/i, not: /korv|kebab/i, raw: true, scb: '01.1.2.2', com: ['Lamm'], slv: /^Lamm /i },
  { key: 'vilt', q: ['älg', 'hjort', 'renskav', 'vildsvin'], re: /älg|hjort|ren|vildsvin|rådjur/i, not: /korv|rostbiff|bacon|pålägg|skivad/i, raw: true, scb: '01.1.2.2', com: ['Älg', 'Hjort', 'Ren', 'Rådjur', 'Vildsvin'], slv: /^(Älg|Hjort |Ren |Rådjur|Vildsvin|Vilt|Renskav|Hare|Kanin|Häst)/ },
  // --- Poultry
  { key: 'kycklingfile', q: 'kycklingfilé', re: /kycklingfilé|kycklingbröst|bröstfilé/i, not: /marinerad|panerad|grillad|strimlad|pålägg|kokt|innerfilé/i, raw: true, scb: '01.1.2.2', com: ['Kyckling'], slv: /^Kyckling bröstfilé/, off: ['en:chicken-breasts'] },
  { key: 'kycklinglar', q: 'kycklinglårfilé', re: /lår|ben|klubb/i, not: /marinerad|panerad|grillad/i, raw: true, scb: '01.1.2.2', slv: /^Kyckling (lår|ben|vinge)/ },
  { key: 'kyckling-hel', q: 'hel kyckling', re: /hel kyckling|kyckling hel|grillad kyckling/i, raw: true, scb: '01.1.2.2', slv: /^Kyckling (kött|grillad|kokt|marinerad|delar)|^Höna|^Kyckling friterad/ },
  { key: 'kycklingfars', q: 'kycklingfärs', re: /kycklingfärs|färs kyckling/i, raw: true, scb: '01.1.2.2', slv: /^Kyckling färs|^Kycklingburgare rå/ },
  { key: 'kalkon', q: 'kalkon', re: /bröstfilé|kalkonfärs|kalkonklubba/i, not: /rökt|skivad|pastrami|svartpeppar/i, raw: true, scb: '01.1.2.2', com: ['Kalkon'], slv: /^Kalkon (filé|rå|kokt|stekt)/ },
  { key: 'anka', q: 'ankbröst', re: /anka|ankbröst|anklår/i, raw: true, scb: '01.1.2.2', slv: /^(Anka|Gås|Duva|Fasan|Ripa|Struts)/ },
  // --- Sausages and cold cuts
  { key: 'falukorv', q: 'falukorv', re: /falukorv/i, not: /kyckling|vegan|skivad/i, scb: '01.1.2.5', slv: /^Korv falukorv|^Korvkaka/ },
  { key: 'grillkorv', q: 'grillkorv', re: /korv/i, not: /vegan|veg|kyckling|chorizo|bröd/i, scb: '01.1.2.5', slv: /^Korv (grillkorv|varmkorv|wienerkorv|fläskkorv|middagskorv|prinskorv|frukostkorv|värmlandskorv|isterband|kryddkorv|bratwurst|ren|lamm)/ },
  { key: 'kycklingkorv', q: 'kycklingkorv', re: /kyckling/i, scb: '01.1.2.5', slv: /^Korv kycklingkorv/ },
  { key: 'chorizo', q: 'chorizo', re: /chorizo|salsiccia|kabanoss/i, scb: '01.1.2.5', slv: /^Korv (chorizo|salsiccia|kabanoss)/ },
  { key: 'salami', q: 'salami', re: /salami|medvurst|pepperoni/i, scb: '01.1.2.3', slv: /^Påläggskorv/ },
  { key: 'blodpudding', q: 'blodpudding', re: /blodpudding/i, scb: '01.1.2.5', slv: /^Blodpudding|^Blodpalt|^Blodbröd/ },
  { key: 'leverpastej', q: 'leverpastej', re: /leverpastej|pastej/i, not: /vegan|fisk/i, scb: '01.1.2.5', slv: /^Leverpastej|^Lantpaté|^Grönpepparpaté|^Gåsleverpastej/ },
  { key: 'sylta', q: 'sylta', re: /sylta/i, scb: '01.1.2.5', slv: /sylta$|^Rullsylta/i },
  { key: 'kottbullar', q: 'köttbullar', re: /köttbullar/i, not: /vegan|veg|kyckling|sås|soja|vego/i, scb: '01.1.2.5', slv: /^Köttbullar (frysvara|stekta frysvara)/ },
  { key: 'kebab', q: 'kebabkött', re: /kebab|gyros/i, not: /sås|krydd/i, scb: '01.1.2.5', slv: /^Kebabkött/ },

  // --- Fish and seafood
  { key: 'lax', q: 'laxfilé', re: /lax/i, not: /rökt|gravad|kallrökt|varmrökt|burgare|biff|bullar|pastej/i, raw: true, scb: '01.1.3.1', com: ['Lax', 'Regnbågslax', 'Röding', 'Öring'], slv: /^(Lax (odlad|vildfångad|stekt|kokt)|Regnbågslax (odlad rå|rå|inkokt)|Pinklax|Röding rå|Öring)/ },
  { key: 'torsk', q: ['torskfilé', 'sejfilé', 'kolja', 'alaska pollock', 'fiskfilé'], re: /filé|torsk|sej|kolja|pollock/i, not: /sås|kattmat|panerad|gratäng|rom|lever|lax|tonfisk/i, raw: true, scb: '01.1.3.1', com: ['Torsk', 'Fisk vit', 'Fisk', 'Kolja', 'Sej', 'Alaska pollock', 'Kummel', 'Vitling', 'Hoki', 'Pangasiusmal', 'Tilapia', 'Flundra', 'Rödspätta', 'Gös', 'Abborre', 'Gädda', 'Hälleflundra', 'Sik', 'Strömming', 'Sill', 'Makrill', 'Ål', 'Kapkummel'], slv: /^(Torsk (rå|filé kokt|stekt)|Kolja (rå|kokt)|Sej rå|Alaska pollock|Kummel rå|Kapkummel|Vitling (rå|kokt)|Hoki|Pangasiusmal|Tilapia|Flundra|Rödspätta (rå|filé (kokt|stekt))|Gös|Abborre (rå|kokt)|Gädda (rå|kokt)|Hälleflundra (odlad|vild|kokt)|Sik (rå|kokt)|Strömming (rå|filé stekt|kokt)|Sill rå|Makrill (rå|kokt|stekt)|Ål rå|Marulk|Piggvar|Havsabborre|Guldsparid|Braxen|Lake|Siklöja|Lutfisk)/ },
  { key: 'panerad-fisk', q: 'panerad fisk', re: /panerad|fiskpinnar|frasig/i, scb: '01.1.3.3', slv: /^Fiskpinnar|panerad stekt$|^Fisk (m\. mandel|cornflakesfisk)/ },
  { key: 'tonfisk', q: 'tonfisk', re: /^Tonfisk/i, not: /&|finfördelad|röra|sallad/i, scb: '01.1.3.3', com: ['Tonfisk'], slv: /^Tonfisk/ },
  { key: 'rakor', q: 'räkor skalade', re: /räk/i, not: /röra|sallad|chips|sås|ost/i, scb: '01.1.3.6', com: ['Räkor', 'Krabba', 'Kräfta', 'Hummer', 'Musslor', 'Havskräfta', 'Bläckfisk'], slv: /^(Räka (kokt|konserv)|Krabba|Kräfta|Hummer|Havskräfta|Blåmussla|Mussla|Pilgrimsmussla|Bläckfisk rå|Ostron( konserv\. m\. lag)?$|Surimi)/ },
  { key: 'rokt-lax', q: 'kallrökt lax', re: /lax/i, not: /röra|pastej|burgare/i, scb: '01.1.3.2', slv: /^(Lax (gravad|kallrökt|rimmad|varmrökt)|Regnbågslax (kallrökt|urtagen))/ },
  { key: 'sill', q: 'inlagd sill', re: /sill/i, not: /sallad/i, scb: '01.1.3.2', com: ['Ansjovis, skarpsill'], slv: /^(Sill (inlagd|höstsill|matjessill|olika)|Saltsill (rå|urvattnad konserv\.|kokt)|Ättikströmming|Saltströmming|Surströmming|Böckling (varmrökt|dubbelfilé varmrökt)|Makrill (filé|urtagen)|Röding urtagen|Sik urtagen|Ål varmrökt|Ansjovis|Sardeller|Sardiner)/ },
  { key: 'makrill-tomat', q: 'makrill i tomatsås', re: /makrill/i, scb: '01.1.3.3', slv: /^Makrill filé i/ },
  { key: 'kaviar', q: 'kaviar', re: /kaviar/i, not: /tång/i, scb: '01.1.3.7', com: ['Fiskrom'], slv: /^Påläggskaviar|^Fiskrom|^Löjrom|^Stenbitsrom|^Sikrom/ },
  { key: 'fiskbullar', q: 'fiskbullar', re: /fiskbullar|fiskbollar/i, scb: '01.1.3.3', slv: /^Fiskbullar konserv|^Fiskbullar m\. hummersås/ },

  // --- Eggs above; grains, bread, pasta
  { key: 'vetemjol', q: 'vetemjöl', re: /vetemjöl/i, not: /fullkorn|special|dinkel|glutenfri/i, scb: '01.1.1.2', com: ['Vete, siktat', 'Vete, stärkelse', 'Vetegluten'], slv: /^Vetemjöl($| bagerivetemjöl| durum)|^Mjölblandning/ },
  { key: 'grahamsmjol', q: ['grahamsmjöl', 'fullkornsvetemjöl', 'dinkelmjöl'], re: /graham|fullkorn|dinkel/i, raw: true, scb: '01.1.1.2', com: ['Vete, fullkorn', 'vete, fullkorn', 'Vete, kli', 'Vete, grodd', 'Vete, flinga'], slv: /^(Vetemjöl fullkorn|Dinkelmjöl|Vetekli|Vetegroddar|Veteflingor|Vetekross|Kruskakli|Matvete|Dinkel)/ },
  { key: 'ragmjol', q: ['rågmjöl', 'rågsikt'], re: /råg/i, raw: true, scb: '01.1.1.2', com: ['Råg, fullkorn', 'Råg, siktat', 'Råg, flinga'], slv: /^(Rågmjöl|Rågflingor|Rågkli|Rågkross)/ },
  { key: 'havregryn', q: 'havregryn', re: /havregryn/i, not: /glutenfri|eko|snabb|portion|smak/i, raw: true, scb: '01.1.1.1', com: ['Havre, fullkorn', 'Havre, flinga', 'Havre, siktat', 'Havre, kli'], slv: /^(Havregryn|Fiberhavregryn|Havrekli|Havremjöl|Mathavre|Havregrynsgröt|Havreris)/, off: ['en:rolled-oats'] },
  { key: 'majsmjol', q: ['majsstärkelse', 'maizena', 'polenta', 'majsmjöl'], re: /majs|maizena|polenta/i, raw: true, scb: '01.1.1.2', com: ['Majs, stärkelse', 'Majs, siktat', 'Majs, fullkorn'], slv: /^(Majsstärkelse|Majsmjöl|Majsgryn)/ },
  { key: 'potatismjol', q: 'potatismjöl', re: /potatismjöl/i, scb: '01.1.1.9', com: ['Potatismjöl', 'Stärkelse'], slv: /^(Potatismjöl|Arrowrotmjöl)/ },
  { key: 'mannagryn', q: 'mannagryn', re: /mannagryn|semolina/i, raw: true, scb: '01.1.1.1', slv: /^Mannagryn($|sgröt)/ },
  { key: 'ris', q: 'jasminris', re: /ris/i, not: /kaka|gröt|nudlar|mjöl|snabb|portion|kokpåse|risotto|vild/i, raw: true, scb: '01.1.1.1', com: ['Ris, korn', 'Ris, siktat', 'Ris, fullkorn'], slv: /^Ris (basmati|jasmin|långkornigt|rundkornigt|grötris|råris|avorio|sushiris|snabbris|vildris)|^Risgrynsgröt|^Saffransris/, off: ['en:rices'] },
  { key: 'bulgur', q: 'bulgur', re: /bulgur|couscous|matkorn|korngryn|quinoa/i, raw: true, scb: '01.1.1.1', com: ['Korn, fullkorn', 'Korn, siktat', 'Korn, flinga', 'korn, fullkorn', 'Quinoa', 'Hirs', 'Bovete, fullkorn'], slv: /^(Bulgur|Couscous|Korngryn|Kornflingor|Kornmjöl|Grynblandning|Mjölmålla|Hirs|Bovete|Durra|Amarant|Teffmjöl)/ },
  { key: 'pasta', q: 'pasta', re: /spaghetti|penne|makaroner|fusilli|pasta|tagliatelle|farfalle|lasagne/i, not: /färsk|fylld|sås|fullkorn|glutenfri|tortellini|ravioli/i, raw: true, scb: '01.1.1.5', slv: /^Pasta (okokt|kokt (m|u)\. salt$)|^Pasta kokt u\. salt|^Pasta kokt m\. salt$/, off: ['en:pastas'] },
  { key: 'pasta-fullkorn', q: 'fullkornspasta', re: /fullkorn/i, raw: true, scb: '01.1.1.5', slv: /^Pasta (fullkorn|kokt m\. salt fullkorn)/ },
  { key: 'pasta-glutenfri', q: 'glutenfri pasta', re: /glutenfri|majs|ris/i, raw: true, scb: '01.1.1.5', slv: /^Pasta .*glutenfri/ },
  { key: 'pasta-farsk', q: 'färsk pasta', re: /färsk|tortellini|ravioli|gnocchi/i, scb: '01.1.1.5', slv: /^Pasta färsk|^Tortellini/ },
  { key: 'nudlar', q: 'nudlar', re: /nudlar|noodles/i, not: /snabb|kopp|smak|cup/i, raw: true, scb: '01.1.1.5', slv: /^Nudlar/ },
  { key: 'glutenfritt-brod', q: 'glutenfritt bröd', re: /glutenfri/i, scb: '01.1.1.3', slv: /^Bröd .*glutenfri/ },
  { key: 'formfranska', q: 'formfranska', re: /bröd|franska|toast/i, not: /knäcke|glutenfri|tortilla/i, scb: '01.1.1.3', slv: /^Bröd vitt (fibrer|grovt|osötat fibrer|vatten|vete fibrer|typ levain|fullkorn)|^Hamburgerbröd|^Korvbröd/, off: ['en:sliced-breads'] },
  { key: 'rostbrod', q: 'rågbröd', re: /bröd|limpa|kaka|kavring/i, not: /knäcke|glutenfri|tortilla/i, scb: '01.1.1.3', slv: /^Bröd (fröbröd|fullkorn|rågsikt|osötat rågsikt|surdegsbröd)/, off: ['en:wholemeal-sliced-breads', 'en:sourdough-sliced-breads'] },
  { key: 'polarbrod', q: 'tunnbröd', re: /tunnbröd|polar|tekaka|hönö/i, scb: '01.1.1.3', slv: /^Bröd vitt (mjukt|mjölk)/ },
  { key: 'tortilla', q: 'tortilla', re: /tortilla|wraps|pita|naan/i, not: /chips/i, scb: '01.1.1.3', slv: /^Bröd vitt (vetetortilla|vete vatten|vete ojäst|mjukt typ chapati|tortilla)|^Tacoskal/, off: ['en:flatbreads'] },
  { key: 'knackebrod', q: 'knäckebröd', re: /knäcke|hårt bröd|spisbröd/i, not: /glutenfri/i, scb: '01.1.1.3', slv: /^Hårt bröd (?!glutenfri|m\. (chia|sesam)frö glutenfri)/, off: ['en:crispbreads'] },
  { key: 'skorpor', q: 'skorpor', re: /skorpor|rusk/i, scb: '01.1.1.3', slv: /^Skorpor|^Ströbröd|^Brödkrutonger/ },
  { key: 'kanelbulle', q: 'kanelbulle', re: /bulle|längd|vetebröd/i, scb: '01.1.1.3', slv: /^Sött vetebröd|^Kanelbulle|^Vetebröd osötat|^Bröd vitt typ croissant|^Bröd vitt croissant/ },
  { key: 'kakor', q: 'kakor', re: /kakor|kex|cookies|drömmar|havreflarn/i, not: /knäcke|ris/i, scb: '01.1.1.3', slv: /^(Kex|Småkakor|Pepparkaka|Cookie|Chokladkaka chocolate chip|Mördegskaka|Savoiardikex|Mandelbiskvi)/ },
  { key: 'mjuk-kaka', q: ['sockerkaka', 'muffins', 'kladdkaka', 'rulltårta', 'bakelse'], re: /kaka|muffin|tårta|bakelse|brownie/i, not: /mix|pepparkak|knäck|ris|glass/i, scb: '01.1.1.3', slv: /^(Mjuk kaka|Muffins|Brownie|Kladdkaka|Toscabit|Mazariner|Punschrulle|Arraksboll|Chokladbiskvi|Wienerbröd|Semla|Prinsesstårta|Gräddtårta|Napoleonbakelse|Jitterbugg|Mandelkubb|Petit-choux|Munk|Potatisbakelse|Bärtårta|Frukttårta|Chokladtårta|Chokladmuffins)/ },
  { key: 'frukostflingor', q: 'frukostflingor', re: /flingor|fras|cornflakes|special|ringar|weetabix|puffar/i, not: /havregryn/i, scb: '01.1.1.4', slv: /^Frukostflingor (?!.*(müsli|granola))|^Risdiet|^Vetediet/ },
  { key: 'musli', q: 'müsli', re: /müsli|granola|crunchy/i, scb: '01.1.1.4', slv: /^Frukostflingor .*(müsli|granola|crunchy)/, off: ['en:mueslis'] },
  { key: 'gryningsvalling', q: 'välling', re: /välling/i, scb: '01.1.9.2', slv: /^Välling (berikad|fullkorn berikad|för barn drickf\.)/ },
  { key: 'pannkaka', q: 'pannkakor', re: /pannkak|plättar|crêpe/i, not: /mix|smet/i, scb: '01.1.9.1', slv: /^Pannkaka tunn helfabrikat/ },

  // --- Potatoes and vegetables
  { key: 'potatis', q: 'potatis', re: /potatis/i, not: /mos|chips|gratäng|klyft|pommes|sallad|bakad|krokett|rösti|mjöl|färsk/i, raw: true, scb: '01.1.7.5', com: ['Potatis', 'Potatisfiber'], slv: /^Potatis (?!konserv|tärnad|m\. skal bakad u\. salt i)|^Färskpotatis|^Potatis rå/, off: ['en:potatoes'] },
  { key: 'pommes', q: 'pommes frites', re: /pommes|strips|klyft|wedges/i, scb: '01.1.7.8', slv: /^Pommes frites|^Klyftpotatis|^Potatiskrokett|^Schweizisk potatiskaka|^Potatis tärnad/, off: ['en:frozen-fries'] },
  { key: 'potatismos-pulver', q: 'potatismos pulver', re: /mos/i, scb: '01.1.7.9', slv: /^Potatismos pulver/ },
  { key: 'sotpotatis', q: 'sötpotatis', re: /sötpotatis/i, raw: true, scb: '01.1.7.5', com: ['Sötpotatis'], slv: /^Sötpotatis (rå|kokt)/ },
  { key: 'morot', q: 'morötter', re: /morot|morötter/i, not: /juice|riven|baby|konserv/i, raw: true, scb: '01.1.7.4', com: ['Morot', 'Palsternacka', 'Rotselleri', 'Kålrot', 'Rödbeta', 'Rotpersilja', 'Jordärtskocka', 'Rädisa', 'Pepparrot', 'Majrova', 'Svartrot', 'Rättika'], slv: /^(Morot( kokt)?|Palsternacka( kokt)?|Rotselleri( kokt)?|Kålrot( kokt)?|Rödbeta( kokt)?|Rotpersilja|Jordärtskocka|Rädisa|Pepparrot|Majrova|Svartrot|Rättika)($| m\. salt| u\. salt)/ },
  { key: 'lok', q: 'gul lök', re: /lök/i, not: /rostad|stekt|syltlök|purjo|vår|pulver|soppa/i, raw: true, scb: '01.1.7.4', com: ['Lök (gul, röd)', 'Purjolök', 'Vitlök', 'Gräslök'], slv: /^(Lök (gul|röd)|Purjolök|Vitlök)($| frysvara| kokt m\. salt)/ },
  { key: 'tomat', q: 'tomater', re: /^(Kvisttomat|Tomat|Tomater|Plommontomater)\b/i, not: /cocktail|baby|mix|kumato|eko|körsbär|perfect|soltorkade|krossade|passerade|hela|skalade|marzano/i, scb: '01.1.7.2', com: ['Tomat'], slv: /^Tomat($| körsbärstomat)/ },
  { key: 'gurka', q: ['gurka', 'squash', 'aubergine'], re: /^(Gurka|Squash|Zucchini|Aubergine)\b/i, not: /salt|smörgås|inlagd|skivad|eko|finhackad/i, raw: true, scb: '01.1.7.2', com: ['Gurka', 'Squash', 'Aubergine', 'Pumpa', 'Okra'], slv: /^(Gurka|Squash|Aubergine|Pumpa)($| kokt| stekt| grillad)/ },
  { key: 'paprika', q: 'paprika', re: /paprika/i, not: /pulver|krydda|grillad|sallad|chips|inlagd/i, raw: true, scb: '01.1.7.2', com: ['Paprika', 'Chilipeppar'], slv: /^(Paprika (grön|gul|röd|förvälld|stekt)|Chilipeppar)/ },
  { key: 'isberg', q: 'isbergssallad', re: /^Sallad Isberg/i, scb: '01.1.7.1', com: ['Sallad'], slv: /^(Isbergssallad|Huvudsallat|Kruksallat|Romansallat)/ },
  { key: 'sallad', q: ['ruccola', 'babyspenat', 'salladsmix', 'machésallad'], re: /sallad|ruccola|spenat|mix|mâche|maché/i, not: /pasta|potatis|dressing|kyckling|räk|kål|fryst|frysta/i, scb: '01.1.7.1', com: ['Groddar', 'Trädgårdskrasse', 'Mangold'], slv: /^(Ruccolasallat|Mâchesallat|Friséesallat|Endivesallat|Spenat färsk|Mangold|Vattenkrasse|Trädgårdskrasse|Alfalfagroddar|Linsgroddar|Mungbönsgroddar|Sojabönsgroddar)/ },
  { key: 'kal', q: 'vitkål', re: /kål/i, not: /sallad|soppa|rabbi/i, raw: true, scb: '01.1.7.1', com: ['Vitkål', 'Rödkål', 'Salladskål', 'Grönkål', 'Savojkål', 'Kålrabbi', 'Brysselkål', 'Pak choi'], slv: /^(Vitkål|Rödkål|Salladskål|Grönkål|Savojkål|Sellerikål|Brysselkål|Kålrabbi)($| kokt| frysvara)/ },
  { key: 'broccoli', q: 'broccoli', re: /broccoli|blomkål/i, not: /fryst|gratäng|soppa/i, raw: true, scb: '01.1.7.1', com: ['Broccoli', 'Blomkål', 'Sparris', 'Stjälkselleri', 'Fänkål', 'Kronärtskocka'], slv: /^(Broccoli|Blomkål|Sparris grön|Stjälkselleri|Fänkål|Kronärtskocka)($| kokt)/ },
  { key: 'frysta-gronsaker', q: 'frysta grönsaker', re: /wok|grönsaker|blandning|ärter|bönor|majs|broccoli/i, raw: true, scb: '01.1.7.8', com: ['Ärter utan skida (utgångsläge rå)', 'Bönor med balja', 'Ärter med skida', 'Majs', 'Spenat'], slv: /^(Blomkål|Broccoli|Brysselkål|Grönkål|Lök gul|Majskolv|Majskorn|Paprika grön röd|Purjolök|Spenat|Vaxbönor|Gröna bönor|Gröna ärtor|Champinjon skivad|Grönsaksblandning m\. [a-zåäö ,]+) frysvara|^Grönsaksblandning .*frysvara|^Gröna ärtor (frysvara|kokta m\. salt frysvara)|^Gröna bönor$|^Vaxbönor$|^Sockerärtor$|^Majskolv( kokt)?$|^Wokgrönsaker (Asiatiska|Classic)/, off: ['en:frozen-mixed-vegetables', 'en:frozen-vegetables'] },
  { key: 'champinjon', q: 'champinjoner', re: /champinjon|svamp|kantarell|shiitake|ostronskivling/i, not: /konserv|stuvning|sås|soppa/i, raw: true, scb: '01.1.7.4', com: ['Champinjon', 'Svamp, odlad', 'Kantareller'], slv: /^(Champinjon|Kantarell gul|Shiitakesvamp|Ostronskivling)($| skivad)/ },
  { key: 'avokado', q: 'avokado', re: /avokado/i, not: /röra|guacamole/i, scb: '01.1.7.2', com: ['Avokado'], slv: /^Avokado/ },
  { key: 'orter', q: ['basilika i kruka', 'persilja', 'dill', 'koriander'], re: /kruka|knippe|färsk|^(Persilja|Dill|Koriander)\b/i, not: /burk|fryst|tapenade|pastasås|chips|sås/i, pieceG: 25, scb: '01.1.9.4', com: ['Persilja', 'Dill', 'Basilika', 'Koriander'], slv: /^(Basilika färsk|Dill färsk|Persilja blad|Koriander blad|Grönmynta)/ },
  { key: 'ingefara', q: 'ingefära', re: /ingefära/i, not: /shot|dryck|syltad|pulver/i, scb: '01.1.7.4', com: ['Ingefära'], slv: /^Ingefära/ },
  { key: 'krossade-tomater', q: 'krossade tomater', re: /krossade|passerade|hela tomater/i, scb: '01.1.7.9', com: ['Tomat krossad'], slv: /^Tomat (hel|krossad) konserv/ },
  { key: 'tomatpure', q: 'tomatpuré', re: /puré/i, scb: '01.1.7.9', slv: /^Tomatpuré/ },
  { key: 'inlagd-gurka', q: 'inlagd gurka', re: /gurka|bostong|pickles|rödbet/i, scb: '01.1.7.9', slv: /^(Gurka inlagd|Bostongurka|Saltgurka|Ättiksgurka|Gurka fermenterad|Rödbeta inlagd|Syltlök|Fefferoni|Grönsaksblandning el\. pickels|Surkål)/ },
  { key: 'oliver', q: 'oliver', re: /oliv/i, not: /olja|tapenade/i, scb: '01.1.7.9', com: ['Oliver'], slv: /^Oliver/ },
  { key: 'soltorkad', q: 'soltorkade tomater', re: /soltorkad/i, scb: '01.1.7.9', slv: /^Tomat torkad/ },

  // --- Legumes
  { key: 'bonor-konserv', q: 'kidneybönor', re: /bönor|kikärtor|linser/i, not: /tomatsås|chili|snacks/i, scb: '01.1.7.9', slv: /^(Kidneybönor|Kikärtor konserv|Stora vita bönor konserv|Svarta bönor konserv|Gröna linser konserv|Röda linser konserv|Bruna bönor rullpack)/, off: ['en:chickpeas'] },
  { key: 'bonor-torkade', q: ['röda linser', 'torkade kikärtor', 'gula ärtor', 'bruna bönor'], re: /linser|kikärtor|ärtor|bönor/i, not: /konserv|tetra|burk|snacks|pasta|tomat|chips|gröna ärtor|kokta|i vatten/i, raw: true, scb: '01.1.7.6', com: ['Bönor utan balja', 'Bönor utan balja (utgångsläge rå)', 'Linser', 'Ärter utan skida (utgångsläge torkad)', 'Ärter utan skida'], slv: /^(Linser torkade|Röda linser torkade|Gröna linser torkade|Kikärtor torkade|Kidney bönor torkade|Bruna bönor torkade|Vita bönor torkade|Bondbönor|Mungbönor|Vignabönor|Sojabönor torkade|Gula ärtor|Gröna el\. gula ärtor torkade|Gråärtor|Åkerbönor|Röda bönor torkade)/, off: ['en:lentils'] },
  { key: 'bonor-tomatsas', q: 'vita bönor i tomatsås', re: /bönor/i, scb: '01.1.7.9', slv: /^Vita bönor m\. tomatsås/ },
  { key: 'konserv-gronsaker', q: 'majs konserv', re: /majs|ärter|bönor|champinjon/i, scb: '01.1.7.9', com: ['Bambuskott', 'Vattenkastanj', 'Vinblad'], slv: /^(Potatis|Morot|Bambuskott|Champinjon|Sparris vit|Surkål|Gröna ärtor|Svamp|Kantarell|Majskorn|Gröna bönor|Vaxbönor|Grönsaksblandning ärtor morot|Mungbönsgroddar|Sojabönsgroddar) konserv\. (u|m)\. lag$/ },
  { key: 'hummus', q: 'hummus', re: /hummus/i, scb: '01.1.7.9', slv: /^(Hummus|Rödbetshummus)/, off: ['en:hummus', 'en:classic-hummus'] },

  // --- Fruit and berries
  { key: 'apple', q: 'äpplen', re: /äpple/i, not: /juice|mos|chips|torkad|dryck|cider|kaka|paj/i, scb: '01.1.6.3', com: ['Äpple', 'Päron', 'Plommon', 'Persika', 'Nektarin', 'Aprikos', 'Körsbär', 'Kvitten'], slv: /^(Äpple( |$)(?!konserv|torkat)|Päron$|Plommon$|Persika$|Nektarin|Aprikos$|Sötkörsbär|Surkörsbär$|Kvitten|Paradisäpple)/ },
  { key: 'banan', q: 'bananer', re: /banan/i, not: /chips|torkad|smoothie|dryck|kaka|bröd/i, scb: '01.1.6.1', com: ['Banan'], slv: /^Banan($| kokbanan)/ },
  { key: 'apelsin', q: ['apelsiner', 'clementiner', 'grapefrukt'], re: /^(Apelsin|Clementin|Mandarin|Grapefrukt)/i, not: /juice|saft/i, scb: '01.1.6.2', com: ['Apelsin', 'Grapefrukt'], slv: /^(Apelsin|Grapefrukt|Småcitrus clementin mandarin tangerin satsumas|Kumquat|Apelsinskal)$/ },
  { key: 'citron', q: ['citron', 'lime'], re: /^(Citron|Citroner|Lime) (Klass|Eko)/i, scb: '01.1.6.2', com: ['Citron', 'Lime'], slv: /^(Citron$|Lime$|Citronskal)/ },
  { key: 'tropisk', q: ['mango', 'ananas', 'kiwi', 'vattenmelon', 'honungsmelon'], re: /^(Mango|Ananas|Kiwi|Melon|Vattenmelon|Honungsmelon|Galiamelon|Cantaloupe)\b/i, not: /torkad|dried|fryst|frysta|juice|choklad|bitar|eko|smoothie|skivad/i, scb: '01.1.6.1', com: ['Mango', 'Ananas', 'Kiwi', 'Melon', 'Papaya', 'Passionsfrukt', 'Granatäpple', 'Exotisk frukt,liten, icke ätbart skal'], slv: /^(Mango$|Ananas$|Kiwi|Galiamelon|Honungsmelon|Nätmelon|Vattenmelon|Papaya$|Passionsfrukt|Granatäpple|Litchi|Carambole|Cherimoya|Guava|Physalis|Sharon|Kaktusfikon|Fikon$)/ },
  { key: 'vindruvor', q: 'vindruvor', re: /druv/i, not: /juice|socker|kärnolja/i, scb: '01.1.6.5', com: ['Vindruvor'], slv: /^Vindruvor/ },
  { key: 'bar-farska', q: ['jordgubbar', 'hallon', 'blåbär', 'björnbär'], re: /^(Jordgubbar|Hallon|Blåbär|Björnbär)( Import| Odlade)? Klass/i, scb: '01.1.6.4', slv: /^(Jordgubbar|Hallon( importerade)?|Blåbär( amerikanska)?|Björnbär|Vinbär (röda|svarta|vita)|Krusbär|Lingon|Hjortron|Tranbär|Fläderbär|Havtorn|Rönnbär|Odon|Mullbär|Aronia (slånaronia|svart)|Rabarber tillagad u\. socker)$/ },
  { key: 'bar-frysta', q: 'frysta blåbär', re: /blåbär|hallon|jordgubb|bär|mango|frukt/i, scb: '01.1.6.6', com: ['Jordgubbar', 'Hallon', 'Blåbär', 'Björnbär', 'Svarta vinbär', 'Röda vinbär', 'Krusbär', 'Lingon', 'Bär', 'Hjortron', 'Tranbär', 'Fläderbär', 'Rabarber', 'Nypon'], slv: /^(Blåbär|Hallon|Jordgubbar|Björnbär|Mango|Ananas|Avokado|Hallon blåbär)( hela| skivade)?( m\. socker)? frysvara/, off: ['en:frozen-berries'] },
  { key: 'torkad-frukt', q: 'russin', re: /russin|dadlar|aprikoser|fikon|katrinplommon|tranbär|torkad/i, scb: '01.1.6.7', com: ['Dadlar', 'Kokosnöt, torkad', 'Blåbär, torkad', 'Tranbär, torkad'], slv: /^(Aprikos|Banan|Blåbär|Dadlar|Fikon|Katrinplommon|Persika|Päron|Papaya|Mango|Tranbär|Gojibär|Äpple|Nypon) torka(d|de|t)( u\. frön)?$|^(Russin|Frukt torkad|Bananchips)/ },
  { key: 'fruktkonserv', q: ['persikor', 'ananas i juice', 'fruktcocktail'], re: /halvor|i egen juice|i juice|i lag|fruktcocktail|skivad i/i, scb: '01.1.6.9', slv: /konserv\. m\. (juice|sockerlag|lättsockrad lag)$|^Fruktcocktail|^Frukt bär konserv|^Äpple konserv/ },
  { key: 'appelmos', q: 'äppelmos', re: /äppelmos/i, scb: '01.1.8.3', slv: /^Äppelmos|^Äppelkompott/ },

  // --- Nuts and seeds
  { key: 'notter', q: 'cashewnötter', re: /nötter|mandel|mandlar/i, not: /choklad|smör|kräm|mjölk|dryck|massa|mjöl|chili|bar/i, scb: '01.1.6.8', com: ['Mandel', 'Nöt, hasselnöt', 'Nöt, cashewnöt', 'Nöt, valnöt', 'Nöt, pistagenöt', 'Nöt, paranöt', 'Kokosnöt', 'Pinjekärnor frön'], slv: /^(Cashewnötter|Hasselnötter|Valnötter|Paranötter|Pekannötter|Macadamianötter|Pistaschnötter|Sötmandel|Nötter blandade|Kokosnöt|Kokosflingor|Kastanjer|Pinjefrö)/, off: ['en:nuts'] },
  { key: 'jordnotter', q: 'jordnötter', re: /jordnöt/i, not: /smör|choklad|bågar|sås/i, scb: '01.1.6.8', com: ['Jordnöt'], slv: /^Jordnötter (rostade|torkade)/ },
  { key: 'jordnotssmor', q: 'jordnötssmör', re: /jordnötssmör|peanut butter/i, scb: '01.1.6.9', slv: /^Jordnötssmör/, off: ['en:peanut-butters'] },
  { key: 'fron', q: ['solrosfrön', 'pumpakärnor', 'linfrö', 'chiafrön', 'sesamfrön'], re: /frön|frö|chia|linfrö|sesam|pumpakärnor/i, not: /bröd|knäcke|kex|olja/i, scb: '01.1.9.4', com: ['Solrosfrön', 'Sesamfrö', 'Linfrö', 'Vallmofrö', 'Senapsfrön', 'Hampafrö', 'Pumpafrö', 'Chiafrö'], slv: /^(Solrosfrö|Sesamfrö (m|u)\. skal|Linfrö hela|Vallmofrö|Pumpafrö|Chiafrö|Hampafrö (m|u)\. skal|Psylliumfröskal)$/, off: ['en:shelled-sunflower-seeds'] },
  { key: 'tahini', q: 'tahini', re: /tahini|sesampasta/i, scb: '01.1.6.9', slv: /^Tahini/ },
  { key: 'mandelmassa', q: 'mandelmassa', re: /mandelmassa|marsipan/i, scb: '01.1.6.9', slv: /^Mandelmassa|^Mandelmjöl/ },
  { key: 'kokosmjolk', q: 'kokosmjölk', re: /kokosmjölk|coconut milk|kokosgrädde/i, scb: '01.1.6.9', slv: /^Kokosmjölk/, off: ['en:coconut-milks'] },

  // --- Fats and oils
  { key: 'rapsolja', q: 'rapsolja', re: /rapsolja|matolja/i, not: /spray|kallpressad/i, density: 0.92, scb: '01.1.5.1', com: ['Olja rapsolja', 'Fett vegetabiliskt fett och olja', 'Olja solrosolja', 'Olja sojaolja', 'Olja palmolja'], slv: /^(Rapsolja|Matolja|Solrosolja|Sojaolja|Majsolja|Frityrolja|Druvkärnolja|Tistelolja|Palmolja|Vetegroddsolja)/ },
  { key: 'olivolja', q: 'olivolja', re: /olivolja/i, not: /spray|smak/i, density: 0.92, scb: '01.1.5.1', com: ['Olja olivolja'], slv: /^Olivolja/ },
  { key: 'kokosolja', q: 'kokosolja', re: /kokosolja|kokosfett/i, scb: '01.1.5.1', com: ['Olja kokosolja kokosfett'], slv: /^(Kokosolja|Kokosfett)/ },
  { key: 'sesamolja', q: 'sesamolja', re: /sesamolja|linfröolja|hampafröolja/i, density: 0.92, scb: '01.1.5.1', com: ['Olja sesamolja'], slv: /^(Sesamolja|Linfröolja|Hampafröolja)/ },

  // --- Sugar, sweets, spreads
  { key: 'socker', q: 'strösocker', re: /socker/i, not: /florsocker|pärlsocker|rörsocker|vanilj|kandi|fri/i, scb: '01.1.8.1', com: ['Socker'], slv: /^(Socker|Brun farin|Druvsocker|Fruktsocker)$/ },
  { key: 'sirap', q: 'sirap', re: /sirap/i, scb: '01.1.8.2', com: ['Sirap', 'Stärkelsesirap'], slv: /^(Ljus sirap|Glykossirap)/ },
  { key: 'honung', q: 'honung', re: /honung/i, not: /senap|dressing/i, scb: '01.1.8.3', com: ['Honung'], slv: /^Honung/ },
  { key: 'sylt', q: 'hallonsylt', re: /sylt|marmelad|gelé/i, not: /godis/i, scb: '01.1.8.3', slv: /^\S+sylt( |$)|^Apelsinmarmelad|^Marmelad olika|^Gelé (röda|svarta)/, off: ['en:raspberry-jams', 'en:strawberry-jams'] },
  { key: 'choklad', q: 'mjölkchoklad', re: /choklad|kaka/i, not: /dryck|pulver|boll|kex|glass|sås/i, scb: '01.1.8.5', com: ['Kakao'], slv: /^(Mjölkchoklad|Mörk choklad|Vit choklad|Bakchoklad|Choklad (ljus|chokladpraliner)|Chokladpralin)/ },
  { key: 'kakao', q: 'kakao', re: /kakao|o'boy|chokladdryck|pucko/i, scb: '01.1.8.5', slv: /^(Kakaopulver|Chokladdryckspulver|Kakaobönor|Kakaosmör)/ },
  { key: 'nutella', q: 'nutella', re: /nutella|nougat|hasselnöt|choklad/i, not: /glass|kex|bar/i, scb: '01.1.8.5', slv: /^Nötkräm chokladkräm/, off: ['en:cocoa-and-hazelnuts-spreads'] },
  { key: 'godis', q: ['vingummi', 'lakrits', 'gelégodis', 'godis'], re: /godis|gelé|lakrits|karamell|kola|skum|polka|vingummi|hallonbåtar|mix|sur/i, not: /hink|påse/i, scb: '01.1.8.9', slv: /^(Gelégodis|Karameller|Lakritsgodis|Skumgodis|Kola|Fruktkola|Polkagris|Godisklubba|Knäck$|Naturgodis|Klubba|Marmeladkonfekt|Fruktstång|Skumboll|Mjuk (chokladmaräng|kokos|nougat)|Mintplattor|Maltkulor|Jordnötter m\. chokladöverdrag|Chokladkola|Maräng)/ },
  { key: 'tuggummi', q: 'tuggummi', re: /tuggummi|v6|stimorol|extra/i, scb: '01.1.8.9', slv: /^Tuggummi/ },
  { key: 'chokladbar', q: 'chokladbit', re: /kex|bar|rån|bit|kexchoklad|twix|daim|snickers/i, scb: '01.1.8.5', slv: /^Kex (m\. (kola|mjölkchoklad)|rån m\. choklad)|^Bar (energibar|müslibar|m\. fiber)/ },
  { key: 'glass', q: 'glass 1 liter', re: /glass/i, not: /pinne|strut|bägare|sorbet|veg|havre|soja/i, density: 0.55, scb: '01.1.8.6', slv: /^Glass (fett|gräddglass|lättglass|vaniljsmak|m\. maräng|vaniljglass|glasstårta|mjukglass|parfait)/, off: ['en:ice-cream-tubs'] },
  { key: 'glasspinne', q: ['glasspinne', 'glasstrut'], re: /pinne|strut|bägare|isglass|piggelin|pinnar/i, pieceG: 70, scb: '01.1.8.6', slv: /^Glass (glasspinne|glasstrut|isglass|sorbet|havreglass|sojaglass)|^Glasstrut/ },
  { key: 'efterratt', q: 'vaniljsås', re: /vaniljsås|pudding|kräm|rismål|pannacotta/i, scb: '01.1.8.9', slv: /^(Vaniljsås ätf|Vaniljvisp|Chokladpudding|Vaniljpudding|Brylépudding|Rismål|Kräm m\.|Nyponsoppa ätf|Fruktsoppa|Ostkaka fett|Ostkaka lätt|Pannacotta|Chokladmousse|Glassås|Saftkräm|Saftsoppa|Saftsås)/ },

  // --- Snacks
  { key: 'chips', q: 'chips', re: /chips/i, not: /tortilla|majs|linser|räk/i, scb: '01.1.9.9', slv: /^Chips/ },
  { key: 'snacks', q: 'ostbågar', re: /ostbågar|popcorn|salta pinnar|jordnötsringar|bågar|tortillachips|nachos/i, scb: '01.1.9.9', slv: /^(Ostbågar|Popcorn|Salta pinnar|Jordnötsbågar|Linsbågar|Räkchips|Kikärtor snacks|Chilinötter|Japanmix|Kex salta|Riskaka|Linskaka|Majskaka|Majskrokar)/ },

  // --- Sauces, condiments, spices
  { key: 'ketchup', q: 'ketchup', re: /ketchup/i, scb: '01.1.9.3', slv: /^Ketchup/, off: ['en:tomato-ketchup'] },
  { key: 'senap', q: 'senap', re: /senap/i, not: /sill|frö/i, scb: '01.1.9.3', slv: /^Senap/, off: ['en:mustards'] },
  { key: 'majonnas', q: 'majonnäs', re: /majonn|aioli|bearnaise|remoulad|dressing/i, scb: '01.1.9.3', slv: /^(Majonnäs|Dressing|Aioli|Remouladsås|Bearnaisesås (fett|tillagad)|Kebabsås|Vitlökssås fetthalt|Hamburgerdressing|Senapskräm)/ },
  { key: 'sojasas', q: 'soja', re: /soja|teriyaki|fisksås|ostronsås|sweet chili|chilisås|sambal|sriracha|worcester/i, not: /dryck|färs|bönor|bitar|protein/i, scb: '01.1.9.3', com: ['Sojasås'], slv: /^(Sojasås|Fisksås|Teriyakisås|Sweet chilisås|Chilisås|Röd pepparsås|Grön chilisås|Sötsur sås|Grillsås|Engelsk brown|Miso|Orientalisk sås|Chili- och mangosås|Wasabi)/ },
  { key: 'pastasas', q: 'pastasås', re: /pastasås|tomatsås|pesto|bolognese|arrabbiata/i, scb: '01.1.9.3', slv: /^(Pastasås|Tomatsås (italiensk|kryddstark|till pizza konserv))|^Pesto m\./, off: ['en:red-pestos', 'en:tomato-sauces-with-basil'] },
  { key: 'gravlaxsas', q: ['hovmästarsås', 'skagenröra'], re: /hovmästar|gravlax|dillsås|skagen/i, scb: '01.1.9.3', slv: /^Gravlaxsås kylvara|^Skagenröra m\. majonnäs kylvara/ },
  { key: 'buljong', q: 'buljong', re: /buljong|fond/i, scb: '01.1.9.3', factors: [[/pasta el\. pulver|pulver tärning|tärning$/, 50]], slv: /^\S*buljong/ },
  { key: 'salt', q: 'salt', re: /salt/i, not: /chips|nötter|pinnar|sill|lakrits|smör|örtsalt/i, scb: '01.1.9.3', com: ['Salt'], slv: /^Salt (m\. jod|u\. jod|havssalt|mineralsalt|örtsalt)/ },
  { key: 'vinager', q: ['ättika', 'vinäger'], re: /ättika|vinäger/i, scb: '01.1.9.3', com: ['Vinäger'], slv: /^(Vinäger|Äppelcidervinäger|Ättiksprit)/ },
  { key: 'kryddor', q: 'kryddor', re: /krydd|peppar|kanel|curry|paprikapulver|spiskummin|oregano|timjan|gurkmeja|kardemumma/i, not: /korv|chips|ost|sill|kaka/i, scb: '01.1.9.4', com: ['Peppar', 'Kanel'], slv: /^(Kanel|Kardemumma|Gurkmeja|Kryddnejlika|Muskotnöt|Spiskummin|Koriander frö|Kryddblandning|Dippmix)/ },
  { key: 'jast', q: 'jäst', re: /jäst/i, not: /närings/i, scb: '01.1.9.9', com: ['Jäst'], slv: /^Jäst|^Näringsjäst/ },
  { key: 'bakpulver', q: 'bakpulver', re: /bakpulver|bikarbonat|gelatin/i, scb: '01.1.9.9', com: ['Gelatin'], slv: /^(Bakpulver|Gelatinblad)/ },
  { key: 'vegfars', q: 'sojafärs', re: /färs|bitar|bullar|nuggets|schnitzel|filé|strimlor|pulled|oumph|anamma|quorn/i, not: /nöt|fläsk|kyckling|bland/i, scb: '01.1.9.9', com: ['Sojaprotein', 'Quorn', 'Sojamjöl'], slv: /^(Sojaprotein|Soja- och veteprotein|Mykoprotein (färs|bullar|nugget|schnitzel)|Ärtprotein färs|Veteprotein grytbitar|Havreprotein pulled havre strimlor kylvara)/, off: ['en:meat-analogues', 'en:prepared-meat-cuts-substitutes'] },
  { key: 'vegkorv', q: 'vegokorv', re: /korv/i, scb: '01.1.9.9', slv: /^Korv veg\./, off: ['en:plant-based-grill-sausages'] },
  { key: 'falafel', q: 'falafel', re: /falafel/i, scb: '01.1.9.1', slv: /^Falafel kikärtskroketter frysvara/ },

  // --- Ready meals (frozen/chilled, where people buy them as such)
  { key: 'artsoppa', q: 'ärtsoppa', re: /ärtsoppa/i, scb: '01.1.9.1', slv: /^Ärtsoppa fläsk tillagad konserv/ },
  { key: 'fryspizza', q: 'fryst pizza', re: /pizza/i, not: /deg|krydda|ost|sallad|sås/i, scb: '01.1.9.1', slv: /^Pizza .*(frysvara|kylvara)/ },
  { key: 'pizzadeg', q: 'pizzadeg', re: /pizzadeg|pizzabotten/i, scb: '01.1.1.3', slv: /^Pizzadeg tillagad kylvara|^Deg (smördeg|filodeg|mördeg)/ },
  { key: 'pirog', q: 'pirog', re: /pirog|piroger|empanada/i, scb: '01.1.9.1', slv: /^Pirog m\. kött värmd frysvara/ },
  { key: 'pyttipanna', q: 'pytt i panna', re: /pytt/i, scb: '01.1.9.1', slv: /^Pytt i panna tillagad frysvara/ },
  { key: 'potatisgratang', q: 'potatisgratäng', re: /gratäng/i, scb: '01.1.9.1', slv: /^Potatisgratäng (kylvara|m\. grädde ost värmd frysvara)/ },
  { key: 'potatissallad', q: 'potatissallad', re: /potatissallad/i, scb: '01.1.9.1', slv: /^Potatissallad (kylvara|u\. ägg kylvara)/ },
  { key: 'farsk-sallad', q: 'rödbetssallad', re: /sallad/i, scb: '01.1.9.1', slv: /^Rödbetssallad .*kylvara|^Rödbetssallad kylvara|^Dressing till sallad .*kylvara/ },
  { key: 'lasagne-fryst', q: 'lasagne fryst', re: /lasagne/i, not: /plattor/i, scb: '01.1.9.1', slv: /^Lasagne värmd frysvara/ },

  // --- Drinks
  { key: 'apelsinjuice', q: 'apelsinjuice', re: /juice/i, not: /koncentrat|konc/i, scb: '01.2.1.0', factors: [[/konc\./, 4]], slv: /^(Apelsinjuice|Äppeljuice drickf|Ananasjuice|Druvjuice|Tropisk juice|Juice|Grapefruktjuice|Småcitrusjuice|Morotsjuice|Tomatjuice|Grönsaksjuice|Aprikosnektar|Persikonektar|Katrinplommondryck|Tranbärsdryck)/ },
  { key: 'saft', q: 'saft', re: /saft/i, factors: [[/konc\./, 5]], scb: '01.2.9.0', slv: /^(Saft|Hallonsaft|Svartvinbärssaft|Apelsinsaft|Lingondricka|Äppeldricka|Fruktdryck|Måltidsdryck|Saftglögg|Slush|Sportdryck)/ },
  { key: 'lask', q: 'läsk', re: /cola|läsk|sprite|fanta|zingo|julmust|påskmust|loka|ramlösa/i, scb: '01.2.6.0', slv: /^(Läsk|Julmust|Energidryck)/ },
  { key: 'kolsyrat-vatten', q: ['mineralvatten', 'kolsyrat vatten', 'ramlösa', 'loka'], re: /vatten|ramlösa|loka|bonaqua/i, scb: '01.2.5.0', slv: /^Vatten (mineralvatten|sodavatten|vichyvatten|kokosvatten)|^Fruktdryck m\. kolsyra/ },
  { key: 'kaffe', q: 'bryggkaffe', re: /kaffe/i, not: /kapsel|pod|snabb|instant|bönor/i, scb: '01.2.2.0', factors: [[/espresso/, 0.14], [/bryggt/, 0.06]], com: ['Kaffebönor'], slv: /^Kaffe (bryggt|espresso)/ },
  { key: 'snabbkaffe', q: 'snabbkaffe', re: /snabbkaffe|instant|nescafé/i, scb: '01.2.2.0', factors: [[/drickf/, 0.015]], slv: /^Snabbkaffe/ },
  { key: 'te', q: 'te', re: /\bte\b|tea/i, pieceG: 2, factors: [[/bryggt|drickf/, 0.01]], scb: '01.2.3.0', com: ['Te (svart, vitt, grönt)'], slv: /^(Te bryggt|Örtte|Nyponte|Tepulver)/ },
  { key: 'lattol', q: 'lättöl', re: /lättöl|alkoholfri|öl|folköl/i, scb: '02.1.3.0', com: ['Öl korn'], slv: /^(Öl (alkoholfri|lättöl|pilsner)|Svagdricka)/ },
  // Last: any other frozen ready meal (a catch-all, so every specific item above wins).
  { key: 'fardigratt', q: ['dafgårds', 'findus', 'felix färdigrätt', 'lasagne fryst'], re: /lasagne|gryta|köttbullar|pasta|kyckling|biff|stroganoff|lax|torsk|pytt|curry|chili|wok|risotto|moussaka/i, not: /sås|krydda|plattor|bröd|pizza/i, scb: '01.1.9.1', slv: /frysvara( el\. konserv\.)?$|värmd frysvara/, off: ['en:microwave-meals'] },
];

/** Food groups (Livsmedelsverket's EuroFIR classes) priced by summing raw commodities, when no item
 * prices the food directly: raw foods and home-style dishes. Industrial products need a shelf price. */
export const SUM_GROUPS = new Set([
  'Rött kött', 'Fågel', 'Fisk', 'Fisk och skaldjur', 'Grönsaker och svamp', 'Grönsaker, rotfrukter och svamp',
  'Frukt och bär', 'Potatis och stärkelserika rötter', 'Baljväxter', 'Ägg', 'Mjölk', 'Grädde', 'Krydda',
  'Innanmat och inälvsmat', 'Nöt, frö eller kärna', 'Ris eller annat spannmål', 'Pasta och liknande produkter',
  'Kötträtt', 'Sås i maträtt', 'Cerealierätter t.ex. klimp, risotto, pannkakor med fyllning, couscous, smörgåsar',
  'Fisk- och skaldjursrätt', 'Grönsaksrätter', 'Potatisrätter', 'Soppa', 'Baljväxträtter', 'Pastarätter',
  'Äggrätter', 'Pannkaka eller våffla', 'Dessert', 'Matpaj eller pizza', 'Färdigsallad', 'Svamprätter',
  'Maträtter och efterrätter', 'Livsmedelsrätter och ingredienser', 'Dessertsås', 'Kryddor smaksättare dressing röror',
  'Fåglar', 'Söta kakor', 'Bageriprodukter, söta och/eller feta',
]);

/** Names that mark a bought product rather than a home-made dish: summing ingredients would be too low. */
export const INDUSTRIAL = /frysvara|kylvara|restaurang|konserv\.|pulver|storhushåll|typ [A-ZÅÄÖ]|gatukök|Barnmat|helfabrikat/;

/** Commodities that cost nothing (or next to nothing) in a dish. */
export const FREE = new Set(['Vatten']);
