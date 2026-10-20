# Progress log

Newest first. Each weekly session adds one entry: what was done, what's next, open issues.
Keep entries short — this file is read at the start of every session.

## Next up

**M40 Frukt i säsong** built (PR open); its seasons update with the prices (prices.yml, 1 March and
1 September — check the fruit table in that PR). **M37 Veckomenyn** planned — **don't start until the owner says go**. An "athlete option" (training-day targets) is parked under "Later" in ROADMAP. **M21b** (low security housekeeping) next. **Released v1.6.6** (2026-10-16, M39a; v1.6.5 M38, v1.6.0 M36, v1.5.0 M35, v1.4.0 M33 + M34). Release PRs go on `milestone/` branches (the reviewer only picks those up).
**Owner, once:** allow "GitHub Actions to create and approve pull requests" (repo Settings → Actions →
General) so the price workflow can open its PRs. **Shelf prices** were collected 2026-10-13:
re-check by hand around October 2027 (`pnpm data:base-prices`); seasonal produce (fresh berries
~240 kr/kg in October) reflects that month. **Releasing** from now on:
see CLAUDE.md (version + changelog entry + twa-manifest). **Store links** (`lib/stores.ts`, checked
2026-10-13) can't be tested in CI: re-check the URL patterns by hand every few months. **Budget:** initial JS is 30.5 KB of 40 (M39b; later screens' Swedish strings in strings-later.ts) (FoodSearch lazy since M36) (M34's cost arithmetic and prices are lazy) after M28 moved the
barcode scanner (and the Open Food Facts client), the custom-food editor and the copy sheet out of
the first bundle (lazy, prefetched when idle so they work offline). CI's gzip measures ~0.2 KB more
than a local build — keep ≥ 0.5 KB margin. Strings of new screens go in lazy sections
(strings-*.ts). Next biggest first-bundle parts: i18n.ts (Swedish strings, 6.4 KB), state.ts,
db.ts, targets.ts. PRs: the reviewer agent merges once its review is addressed (owner, 2026-10-11).

## 2026-10-21 — M40 Frukt i säsong (interactive session)

- Owner: fruit for the vitamins and minerals one is short of, in season, automated from the web
  (not hand-made), with the amount for a week. Opt-in card in Näringsämnen (7/30 days).
- Seasons: SCB monthly imports by country (`ImpTotalKNMan`) + Jordbruksverket (yearly harvests;
  monthly producer prices give the Swedish months) + Eurostat Comext (fruit sent on by trade hubs,
  e.g. mango via the Netherlands, counts as from outside Europe). `scripts/fruit-spec.mjs` names only
  product codes, foods and portions; `build-fruit.mjs` computes everything else. Checked against
  what everyone knows: Swedish strawberries Jun–Aug, apples Aug–Jun, Spanish citrus Nov–Apr,
  watermelon May–Aug, persimmon Oct–Dec, bananas all year (never European).
- Week: whole portions per kcal (avocados lost on energy), ≤ 1 750 g; default goals are the most
  important gaps fruit closes at least halfway (potassium alone needs kilos of fruit). Found in the
  e2e run: fat/protein were offered as goals and "3 skiva" — goals are now vitamins, minerals and
  fibre only; portions st/dl only.
- Size: initial JS unchanged (30.5 KB); the table + logic is a lazy chunk (~9 KB, ~3 KB gzip).
- Not done: wild berries (no statistics), monthly Swedish pears/plums (no data), fruit names in
  da/de/fi/so (English, like food names). Jordbruksverket's database states no licence (open data,
  free; credited in Settings).
- Tests: unit 260 ✓, build ✓ (30.5 KB), e2e 157 ✓ (new: fruit.spec.ts, with axe light/dark), Lighthouse ✓.

## 2026-10-16 — M39b Snabbare part 2 (interactive session)

- Measured first: a logged day starts in ~145 ms with all names by ~210 ms; a search right after
  start ~185 ms; reading the library before render ~5–40 ms. So only (a) was worth doing.
- 229 Swedish strings used only by later screens → `src/lib/strings-later.ts` (registers into the
  Swedish dictionary on load; lazy.tsx loads it with every lazy screen; cost-calc imports it).
  `strings-split.test.ts` checks from the import graph that no first-bundle module uses them and
  that every user has them loaded. **Initial JS 34.9 → 30.4 KB**; Lighthouse FCP −64 ms, TTI −76 ms,
  TBT 58 → 37 ms, script start-up 174 → 125 ms.
- Review: the supplement times (`t(`time_${…}`)` in the diary) had been moved — an empty label right
  after start; back in i18n.ts. The guard now expands template keys, allows only checked dynamic keys
  in the first bundle, and checks at runtime that every first-bundle key has text without the later
  strings (it fails on the original bug). The later strings load first after start (cached for
  offline). Initial JS 30.5 KB.
- Tests: unit 245 ✓, build ✓, e2e 156 ✓ (+ a sheet offline after the first visit), Lighthouse ✓.

## 2026-10-15 — M39a Snabbare: measure, start from the phone, smaller first bundle (interactive session)

- `e2e/perf.spec.ts` + marks `il:render`/`il:day`: cold, warm, warm with a 2 s late app page, first
  search (Moto G4, CPU ×4). Playwright routes now see service-worker fetches (config env).
- sw.js: app pages **cache-first**, updated in the background; "Det finns en ny version av appen –
  Starta om" bar when a newer page was fetched (the app asks the worker once listening; the worker
  reads the cached copy before handing it out — a found bug). Warm start with a slow connection
  **~2 110 → ~115 ms**; offline start unchanged; new e2e/update.spec.ts.
- FoodDetail and Nutrients lazy (prefetched with the other screens): **initial JS 38.3 → 34.8 KB**.
  Lighthouse (simulated slow 4G) unchanged within noise (FCP ~1.25 s, TBT ~55 ms).
- Review fixes: every build lists its scripts/styles in the page (`iron-log-assets` meta, a Vite
  plugin); a new version is stored only once its whole set is cached (never a page without its code
  offline); at install the page + what it starts with; only Iron Log's own HTML is stored (not a
  Wi-Fi login page); cache lookups ignore `Vary` (found: a module cached by the worker didn't match
  the page's request → blank offline start); a screen whose code is gone reloads the app once when
  opened (never from a background prefetch); background screen loads one at a time; the update mark
  is a cache entry. Budget check counts only scripts the page loads.
- Perf (isolated, CPU ×4): cold render ~190 ms, diary ~295, warm ~130, warm + slow page ~95,
  first search ~190, Näringsämnen right after start ~250 (its code loading).
- Tests: unit 239 ✓, build ✓ (34.9 KB), e2e 154 ✓ (update.spec: background update + restart, new
  code offline, Wi-Fi login page, gone file → one reload then "Försök igen", offline after first
  visit), Lighthouse ✓. Under heavy local parallel load a few unrelated tests flaked once
  (adaptive follow note, privacy link); alone they pass 8–12×. M39b planned.

## 2026-10-15 — M38 Food cost in the summaries (interactive session)

- With Matkostnad on: the Näringsämnen tab (7 and 30 days) shows "Matkostnad i snitt: ~62 kr/dag · ~434
  kr/vecka" (+ "· ~1 860 kr/månad" for 30 days): averages per logged day, like the nutrient averages,
  "(minst – …)" when some foods have no price; the weekly check-in says what last week's food cost
  and the change per day against the week before. Arithmetic in the lazy cost chunk
  (`CostCalc.period/periodText`); the week before is read only with Matkostnad on.
- Initial JS 38.1 KB (+0.1). Tests: unit 238 ✓ (period sums, partial, recipes, texts), build ✓,
  e2e 146 ✓ (new cost-summary: off → nothing; on → 7/30-day lines; check-in "+100 %"), Lighthouse ✓.

## 2026-10-15 — M36 Find scanned products again (interactive session)

- "Skannade varor (n)" list in the food search (all scanned products, most recently used first);
  scanned products are searchable by generic name, categories, brands and barcode digits
  (`Food.terms`, from Open Food Facts at scan time; older scans by their barcode). Kept in backups.
- Review: the food search is now lazy (prefetched first when idle; 1.95 KB gzip out of the first
  bundle) → **initial JS 38.0 KB** of 40; the scanned list shows 30 rows at a time ("Visa fler").
- Tests: unit 236 ✓ (offTerms, search by package word/brand/barcode part), build ✓, e2e 145 ✓
  (new: package words, last digits, an older scan by barcode, the scanned list), Lighthouse ✓.

## 2026-10-13 — M35 Goal in the profile; follow the estimate (interactive session)

- Goal and pace are in the profile (Settings → Profil), next to the energy target; the automatic
  formula target is the need ± the pace's energy (floor 1200/1500 kcal or basal; no goal while
  pregnant/breastfeeding). Goal helpers moved to `lib/targets.ts` (adaptive.ts re-exports).
- Opt-in "Följ uppskattningen automatiskt": `lib/follow.ts`, once per ISO week when idle after start
  (and right when turned on), steps the target toward the adaptive suggestion by ≤ ±150 kcal
  (`followStep`), records `followWeek`/`followNote` (synced, in backups); the diary shows that week's
  change until dismissed. `loadEstimate` moved to `lib/adaptive-load.ts` (no UI module needed).
- Initial JS 38.8 KB (+0.7: goal logic in targets.ts, the diary note, the settings v3 migration).
  Review: existing users with a goal + automatic energy get it applied once at start, with a notice
  (settings v3); never two follow steps a week even if an older device drops `followWeek`.
- Tests: unit 232 ✓ (goal targets, pace capping, floor, pregnancy, followStep), build ✓, e2e 143 ✓
  (profile goal → 1780/2330/2350 kcal; follow 2280 → 2430 (+150), diary note, once a week),
  Lighthouse ✓. Not a release yet (1.4.0 just shipped): bump with the next one.

## 2026-10-13 — M34 Cost per food and meal (interactive session)

- With Matkostnad on (off by default): each diary entry shows "~4 kr" (own price > typical price;
  recipes from their ingredients), each meal header its total, the day summary "Matkostnad: ~57 kr";
  "minst ~23 kr" when part has no price; foods with no price show nothing.
- Tapping a food's cost opens the price sheet — the shopping list's editor, now one component
  (`PriceForm`); a saved/removed price updates the diary and the list (`lib/cost.ts` setOwnPrice).
- Only a stub is in the first bundle (`lib/cost.ts`, +0.4 KB): the arithmetic and prices
  (`lib/cost-calc.ts`, table) load after first paint when on.
- Release 1.4.0 (version, changelog in 6 languages incl. the older-version sync caveat, twa-manifest).
- Tests: unit 229 ✓ (entry/recipe/meal cost, own > typical, rounding), build ✓ (38.1 KB), e2e 142 ✓
  (new cost.spec: off by default, entry/meal/day, "minst", price edit → ~6 kr everywhere, reload,
  remove, off; axe + 200 % for the diary with costs and the price sheet; what's new now reads the
  versions from package.json/changelog), Lighthouse ✓.

## 2026-10-13 — M33 Typical prices (interactive session)

- Coverage first, as planned: Open Prices (~5 200 SEK prices) has no meat, fish or eggs → owner
  chose a hand-made base list: ~200 willys.se comparison prices (`scripts/prices-spec.mjs`,
  `data/prices-base.json`, `pnpm data:base-prices`, by hand ~yearly). Livsmedelsverket's raw
  commodities per food spread them: direct matches (cooked foods by raw weight) and dishes summed
  from ingredients. SCB's CPI per food group (CC0) moves prices to the latest month; Open Prices
  replaces a shelf price only with enough data and within ×1.5.
- **2 364 of 2 606 foods** priced (all 59 popular ones); `public/data/prices.<hash>.json` 8.9 KB gzip,
  lazy. Reviewed the matches by hand (`node scripts/build-prices.mjs --review`) and fixed over-broad
  name rules (e.g. "margarin" matching fried onions, "Hjort" matching hjortron).
- Twice-yearly workflow `prices.yml` (1 Mar, 1 Sep): fetch, build, test, open PR, start CI (CI got
  `workflow_dispatch`). Setting "Matkostnad" (off by default): shopping list "≈" lines, total share,
  editor hint. Credits in Settings, about and privacy pages.
- Tests: unit 224 ✓ (table sanity: coverage, cooked < raw, staple ranges, every item priced; typical
  vs own price), build ✓ (37.7 KB), e2e 135 ✓ (new: food cost off by default, on → ≈, own price
  wins, no external request), Lighthouse ✓.

## 2026-10-13 — M32 What's new (interactive session)

- The app has a version (package.json, now **1.3.0**) and a changelog (`src/changelog.ts`, 6
  languages, lazy). After a version bump the first start opens "Nyheter" with what's new since the
  version last seen (localStorage `iron-log-seen-version`, recorded once the sheet is open); a fresh install shows nothing; users
  from before M32 who have data see everything since 1.1.0. Back/Okej closes it. Settings shows
  "Iron Log 1.3.0 · Nyheter". The check is a lazy chunk run after the diary is shown.
- Release rule in CLAUDE.md; a unit test fails if package.json's version has no changelog entry.
- **Lighthouse TBT flake found:** it was about.html, not the app. Symbol characters (□↑⋮→) in the
  install instructions (added 2026-10-09) made Chrome search fallback fonts: ~400 ms extra layout,
  TBT 0 or ~210 ms per run. Replaced with words: about.html TBT now 0–50 ms.
- Tests: unit 219 ✓, build ✓ (37.6 KB), e2e 134 ✓ (what’s new ×2, plus axe/200 % for the sheet),
  Lighthouse ✓.

## 2026-10-13 — M31 Offer links (interactive session)

- In "Största posterna", the 5 most expensive priced lines still to buy get links to the user's
  stores: Willys, Coop, Lidl, Hemköp, City Gross search for the item's first word ("Mjölk");
  ICA opens its offers page (its search needs a chosen store). Links open the store's site in a
  new tab; the app fetches nothing (e2e checks no external request). "Mina butiker" picker —
  synced setting `chains` (default Willys, ICA, Coop, Lidl), validated. Privacy page says so.
- URL patterns in lib/stores.ts, checked 2026-10-13 (re-check if a store changes its site).
- Tests: unit 209 ✓ (search term, URLs/encoding), build ✓ (37.3 KB), e2e 129 ✓ (new offer-links
  test), Lighthouse ✓ (one local run TBT 207 ms, re-run passed).

## 2026-10-13 — M30 Shopping list: prices and biggest items (interactive session)

- The list looks back: "Det du åt de senaste 7 dagarna" adds this week's foods (owner: restocking
  is the daily use); "planerat framåt" shows only when future days have entries.
- "Pris" per line: the shelf's comparison price (kr/kg; kr/l via the food's dl density; kr/st via
  its "st" weight) → remembered per food as kr/kg in a new synced store `prices` (IndexedDB v13, in
  backups, validated). Own items take a price in kr. Estimated total with "N utan pris", and a
  "Största posterna" view with each line's share of the total.
- Review fixes: kr/l uses the same density as the amounts (dl, else glas/2); the price editor opens
  with the stored price and can remove it ("Ta bort pris", syncs as a tombstone); one price limit
  (MAX_PRICE) for editor and backups; costs computed once and summed unrounded; lines re-render only
  when their own data changed. Known (last-writer-wins): an older app version drops a typed price on
  an own item, and its next tick of that item syncs back without the price.
- Also: android/twa-manifest.json synced to the owner's v1.2.0 build (Hologram bar/splash colours).
- Tests: unit 207 ✓ (kr/kg conversion incl. glas, limit, line cost, unrounded totals, ranking, bad prices), build ✓ (initial JS 37.3 KB;
  ShoppingSheet 3.7 KB lazy), e2e 128 ✓ (new price/total/biggest-items/look-back test), Lighthouse ✓
  (one local run showed TBT 201 ms vs 200; the re-run passed — nothing on the first screen changed).

## 2026-10-11 — M28 Shopping list (interactive session)

- "Inköpslista" button under the diary → a lazy sheet: add saved meals and recipes (one tap each,
  tap again to add again), the diary's planned days (next 7 days — plan by copying days/meals
  ahead), or an own item ("tandkräm"). Recipes become their ingredients, scaled. Amounts are summed
  per food into the open line and shown shop-friendly: whole "st", dl/l for liquids (a dl measure of
  ~100 g; oats stay in grams), else grams rounded up. Grouped by store section (name rules, Swedish
  and English; "Övrigt" otherwise). Tick off, remove ticked, empty; share as plain text (share sheet,
  else clipboard; ticked items left out).
- New synced store `shopping` (IndexedDB v12), in backups and validated; batch delete in one
  transaction with tombstones.
- Review fixes: the list is capped at 300 lines where items are added (with a message), a backup is
  never cut (only > 3000 refused); saves are one transaction, written before the screen updates;
  sections computed once per change; nut butters/coconut milk → Skafferi; sugar stays in grams.
- CI caught the first bundle at 40.0 KB (local 39.8): the scanner + Open Food Facts client, the food
  editor and the copy sheet are now lazy (prefetched when idle) → 37.2 KB.
- Tests: unit 204 ✓ (expand, summing, sections, amounts, text, sync, backup cap), build ✓ (initial JS 37.2 KB; M28 itself +0.3:
  button, store functions, string), e2e 127 ✓ (new shopping.spec.ts; a11y "shopping list"),
  Lighthouse ✓.

## 2026-10-11 — M26 Weekly check-in (interactive session)

- Settings → Veckans avstämning (off by default). On today's diary, once per new ISO week until
  seen ("Klar"; seen-state syncs): a small teaser → a lazy sheet about the week before: days logged,
  average energy vs. target and macros, weight change between the two weeks' average weigh-ins, the
  M25 estimate and suggested target (only if M25 is on; "Använd" applies it, nothing automatic),
  at most two things that went well (logging ≥ 6 days, energy within 10 %, nutrients reached — only
  where the coverage rule allows), and at most one tip from M27's scoring (a food for the largest
  shortfall, else a swap). No notifications, no streak pressure, neutral wording.
- lib/checkin.ts (ISO weeks, in the first bundle for the teaser) and lib/checkin-report.ts (lazy).
- Tests: unit 196 ✓ (ISO weeks incl. year boundary and summer time, weight change, positives),
  build ✓ (initial JS 39.5 KB, +0.3), e2e 123 ✓ (new checkin.spec.ts; a11y "weekly check-in"),
  Lighthouse ✓.

## 2026-10-11 — M27 Gap fixer, swaps and "what if" (interactive session)

- Settings → Förslag (off by default): on Näringsämnen (7/30 days) a card for the two largest
  shortfalls an everyday food can help with (only where the coverage rule allows): up to 3 foods,
  the user's own first (usual portion), then everyday foods; ranked by nutrient per kcal; each with
  "N g ger X % av det som saknas". No liver products during pregnancy. Swaps for foods logged ≥ 3×
  (curated Livsmedelsverket table in lib/suggest.ts: white bread → rye, white rice → brown, juice →
  fruit, soft drink → soda water…), shown only with a gain ≥ 5 % of a target at the same weight.
- "Om du lägger till" (on by default, switch in Settings): on the food screen, energy and up to 3
  nutrients still short, before → after with the % of target.
- Data: a new `everyday.<hash>.json` per nutrient (foods with household measures, richest per
  kcal, no alcohol, with a portion; 84 KB raw) — scripts/build-top.mjs; the top file is unchanged.
- All lazy (Suggestions 2.1 KB, WhatIf 0.7 KB, strings in strings-suggest.ts / `suggest` in packs).
- Tests: unit 191 ✓ (ranking, portion filter, swaps, strings), build ✓ (initial JS 39.2 KB), e2e
  119 ✓ (new suggest.spec.ts), Lighthouse ✓.

## 2026-10-11 — M29 Hologram theme: Natt and Dag (interactive session)

- Two token sets in styles.css: Dag ("Daylight": pearl, white glass, near-black primary) and Natt
  ("Hologram": #050912, teal/violet glows, glass cards with teal borders). Glows are gradients on one
  fixed layer and glass is plain rgba — no blur filters. System fonts.
- New shapes everywhere: 18 px glass cards, floating pill tab bar (tabs sized by label), segmented
  period/range controls, big light energy number with gradient bar on the diary, violet "Som vanligt",
  theme-coloured focus rings, links and checkboxes. Space under content scales with text size.
- Settings → Utseende: Auto (follows the phone, also while open) / Dag / Natt, per device
  (localStorage). An inline boot script (src/csp.ts THEME_BOOT, allowed by its sha256 in the CSP —
  no 'unsafe-inline') sets data-theme before first paint; browser bar colour follows. Web manifest
  colours now the night theme (the Android splash follows with the next Bubblewrap build). Known: a
  manifest can't follow the theme, so Dag users also get the dark splash/install UI.
- Design reference: the canvas rows "M29 theme" (link in ROADMAP).
- Tests: unit 185 ✓ (CSP hash matches the script), build ✓ (CSS 3.7 KB; initial JS 38.9 KB, +0.4 —
  slightly over the planned ±0.3: theme module, big-number variant, strings), e2e 118 ✓ (new
  theme.spec.ts; axe in light/dark = Dag/Natt; 200 % text), Lighthouse ✓.

## 2026-10-11 — M25 Adaptive energy expenditure (interactive session)

- Opt-in (Settings → "Anpassad energiförbrukning", off by default; off = nothing shown anywhere).
  Estimate = average intake − weight trend × 7700 kcal/kg over the last 28 days (ending yesterday):
  a least-squares line through the weigh-ins; days count when marked complete, or when logged and
  ≥ 60 % of the median intake. Needs ≥ 10 days and ≥ 3 weigh-ins spanning ≥ 14 days, else says what
  is missing; refuses results outside 1000–6000 kcal. Shown with ± (≈ 2 standard errors) next to
  the formula estimate.
- Goal (lose / keep / gain) and pace (0.25/0.5/0.75 kg a week, only up to 0.75 % of body weight);
  suggested target never below 1200 (women) / 1500 (men) kcal or the basal rate; no goals during
  pregnancy or breastfeeding. "Använd som mitt energimål" sets it once; nothing changes by itself.
- "Dagen är komplett" button in the diary (only when on): new synced store `days` (IndexedDB v11),
  in backups. Strings of the card load with Settings (strings-energy.ts, `energy` in the packs).
- Review fixes: the ± uses t-quantiles for few weigh-ins plus 0.3 kg scale noise over the span
  (3 perfect weigh-ins no longer show "±10"); days with foods of unknown energy never count; only
  the window's weigh-ins are read; the estimate is cached until something is written.
- Known: a device still on an older version drops `adaptive/goal/pace` from settings, so its next
  settings change syncs back and turns the feature off here (until it updates). A day un-marked on
  one device comes back if an older backup with the mark is restored (like other stores).
- Also: android/twa-manifest.json now at 1.1.0 (code 3), matching the released APK.
- Tests: unit 184 ✓ (estimator, uncertainty, unknown foods, counted days, paces/floor, strings,
  backup), build ✓ (initial JS 38.5 KB), e2e 117 ✓ (new adaptive.spec.ts; a11y "adaptive energy
  (on)"), Lighthouse ✓.

## 2026-10-11 — M24 "Your usual" & shortcuts (interactive session)

- "Som vanligt: …" card on an empty meal of today, only when the same meal (≥ 80 % of energy from
  the same foods, both ways) was logged on ≥ 4 of the last 6 comparable days (weekdays/weekends
  separately), around the time the user usually logs it. One tap logs it; "Inte nu" hides it for
  the day; three in a row pause it 14 days (device-local); off switch in Settings → Sparade måltider.
  Rules in lib/usual-find.ts (lazy, 0.7 KB), computed once a day from 3 weeks of diary.
- Home-screen shortcuts: `?add` (add sheet for the meal of the time of day), `?water` (+2 dl); the
  query is removed so a reload doesn't repeat it. Also in android/twa-manifest.json — **owner: the
  Android app gets them with the next Bubblewrap build** (`bubblewrap update` + build).
- Coming back to the app on a new day now shows the new day (was: stayed on yesterday).
- Review fixes: one card at most (overlapping windows → the one that started last); the dismissal
  streak starts over when the meal was logged by hand since; earliest logging time per day; only
  meals still empty today are worked out, after the app's idle start-up work.
- Tests: unit 173 ✓ (usual rules, dismissals, overlap), build ✓ (initial JS 38.2 KB), e2e 113 ✓
  (new usual.spec.ts with fixed clock/time zone), Lighthouse ✓.

## 2026-10-11 — M23 Saved meals & portion memory (interactive session)

- Saved meals: "Spara som måltid" under a logged meal (name suggested from its foods; drop foods
  before saving). They show first in the add sheet; one tap logs all foods into that meal. Rename,
  trim or remove from Settings → Sparade måltider. New synced store `templates` (IndexedDB v10),
  in backups (older backups without it still import), validated like every other record.
- "↻ Samma som igår · N kcal" on an empty meal that was logged the day before (double-tap safe).
- Portion memory: each food remembers its last 8 amounts and opens at the most frequent one;
  multiples ½× 1× 1½× 2× of it replace the fixed quick amounts for foods logged before.
- Sync now skips stores it doesn't know (from a newer version) and applies the rest, so future
  stores don't break sync with a not-yet-updated device. A device still on the version *before*
  this one can't sync with a newer one until it updates (it rejects the unknown store); the
  service worker updates it on the next start.
- Review fixes: missing foods of a saved meal are skipped with a notice; a whole meal's usage is
  one write; how often a saved meal is used is kept per device (localStorage), so logging one
  doesn't create sync changes; save/remove guarded; names trimmed on import; the day before is
  only read when a meal is empty; saved meals load after first paint.
- Tests: unit 164 ✓ (new: templates-state, portion memory, backup validation, sync skip), build ✓
  (initial JS 36.9 KB), e2e 111 ✓ (new templates.spec.ts, a11y "save a meal"), Lighthouse ✓.

## 2026-10-09 — Android release and install instructions (interactive session)

- GitHub Release **v1.0.0** with `iron-log.apk` (the owner's signed build, verified: package
  io.github.quoterg.ironlog, 1.0.0, upload-key fingerprint matching assetlinks.json; file and
  certificate SHA-256 in the release notes). The stable link
  `releases/latest/download/iron-log.apk` serves it.
- Landing page and README: install on iPhone (Safari → Share → Add to Home Screen) and Android
  (install from Chrome, or the APK with the Play Protect note and the certificate fingerprint).
- The weekly assetlinks check now requires exactly our package and key (an added entry fails).

## 2026-10-09 — M21a Content-Security-Policy (interactive session)

- S2: strict CSP meta tag in production builds of the app (scripts/styles only from this site,
  WebAssembly for the scanner fallback, network only to this site and Open Food Facts, no plugins,
  base-uri/form-action locked) and in the static pages (no scripts at all). Dev builds have none
  (the dev server injects inline styles).
- e2e `csp.spec.ts` walks the main flows (log food, nutrients and detail, body chart, recipe
  editor, export JSON/CSV, language switch, scan → Open Food Facts upload, sync code, static
  pages) and fails on any `securitypolicyviolation`.
- S1 decision (owner): keep `quoterg.github.io` for now with safeguards; written into CLAUDE.md.
- Existing installs get the policy on their next online load (pages are network-first in the
  service worker). Clickjacking (`frame-ancestors`) can't be covered by a meta tag — accepted
  residual risk until an own origin with real headers (M22).

## 2026-10-09 — M19b Android app (interactive session)

- The owner built and signed the first APK with Bubblewrap (key kept by the owner, not in the
  repository). Two fixes were needed in `android/twa-manifest.json`: `splashScreenFadeOutDuration`
  (missing → broken build.gradle) and `minSdkVersion` 24 (androidbrowserhelper 2.7 needs Android 7).
- `assetlinks.json` with the upload key's fingerprint is live on the user site and verified via
  Google's Digital Asset Links API, so the app opens without a browser bar. The fingerprint is
  also in twa-manifest.json for future builds.

## 2026-10-09 — M18c Language review (interactive session)

- The owner reviewed the Danish, German, Finnish and Somali translations and approved them: the
  "(beta)" labels are gone from the language picker; pack headers and CONTRIBUTING say so.
- The screen-reader walk-through moves to M18d.

## 2026-10-09 — M20b In-app Open Food Facts upload (interactive session)

Done (approved by the owner):
- Scan finds nothing (or no nutrition) → "Lägg till produkten på Open Food Facts" opens an in-app
  form: name, brand, the EU label's 8 values per 100 g, photos of the front and the nutrition
  table (shrunk to ≤ 1600 px JPEG before upload), the user's OFF username and password. The app
  posts to OFF's write API (product_jqm2.pl, product_image_upload.pl — CORS-enabled, checked
  against the staging server), then saves the product locally and opens it for logging.
- The password is used for the upload only (cleared afterwards); only the username stays in memory
  for the session (never IndexedDB, backups or sync). Plausibility checks before publishing
  (macros ≤ 100 g, sugar ≤ carbs, sat. fat ≤ fat, sum ≤ 105 g, ≤ 900 kcal). Photos upload in
  parallel, shrunk when chosen; a failed photo never undoes the product. Wrong
  login, no network and refusals get clear messages; a refused photo doesn't undo the product.
- The website link stays as a fallback. Upload-screen strings are lazy (strings-off.ts + `off`
  sections in the packs). Privacy policy and data-safety notes describe the upload.
- Tests: form fields, success with photos, login/refusal/network errors, refused photo; e2e scan →
  upload (OFF mocked, wrong then right password) → log; axe + 200 % on the upload screen.

## 2026-10-09 — M15b Supplement schedules (interactive session)

Done:
- Daily supplements can be limited to weekdays (chips Mon–Sun, in the UI language) and given a
  time of day (morning, midday, evening, night). The diary's checklist shows a day's scheduled
  supplements, as-needed ones and anything already taken, ordered by time of day.
- Stored as optional `days` (0 = Monday) and `time` on the supplement: old data and backups are
  unchanged; backups and sync (same validator) check them — tested — and all seven days is stored
  as "every day".
- Reminders: not built — a web app can't schedule notifications while closed without a server.
- Strings in all six languages. Tests: weekday/schedule logic, backup validation, e2e (today off →
  not on the checklist; back on → shown with its time; no days refused).

## 2026-10-09 — M16b Amino acids (interactive session)

Done:
- Nine essential amino acids (histidine, isoleucine, leucine, lysine, methionine + cysteine,
  phenylalanine + tyrosine, threonine, tryptophan, valine) from USDA, in a new "Essential amino
  acids" group on the Nutrients tab; names in all six languages.
- Targets per kg body weight from WHO/FAO/UNU 2007 (NNR 2023 has none); without a profile weight
  there's no target. Low amino acids appear in "worth a look" like other nutrients — the protein-
  quality hint.
- USDA data rebuilt: now 5 files (each < 190 KB gzip; +~70 KB for users who enable USDA). SLV
  unchanged in size (no amino acids; trailing unknowns are omitted). Top-foods file rebuilt.
- Tests: targets by weight, real values (egg leucine, Met+Cys sum), > 4,000 foods with leucine.
  Initial JS 34.7 KB gzip (+0.3 KB: nutrient definitions).

## 2026-10-09 — M18b Languages (interactive session)

Done:
- Language packs: Swedish stays built in; English, Danish, German, Finnish and Somali are separate
  chunks loaded on demand (startup loads the chosen one before first render; a switch loads it
  first). Missing strings fall back to English, then Swedish. **Initial JS 36.8 → 34.2 KB** gzip,
  because English left the first bundle.
- Danish, German, Finnish and Somali: all UI strings, nutrient names (45), activities (27) and
  household units, plus the sync screens — machine-assisted, marked "(beta)" in the picker.
  Owner's choice of languages (Norwegian dropped; Norwegian browsers get Swedish).
- `nutrientName`, `activityName`, `unitLabel`, `locale`, `decimalComma`, `dataLang` replace the
  sv/en checks across components. Food names: Swedish for sv/da, English for the rest (foods only
  have those two). CSV headers use the same data language.
- Browser language detection: supported languages as-is, nb/nn/no → Swedish, others → English.
- Offline safety: if the saved language's chunk can't load at startup, the app starts with the
  built-in strings; an offline switch to a never-loaded language keeps the current one.
- 200 % text in German and Finnish found the nutrient bars overflowing on long names (e.g.
  "Kertatyydyttymättömät rasvahapot"); bar headers now wrap.
- The import confirmation now matches the restore rules (only adds what is missing or older).
- Tests: `i18n.test.ts` (keys, placeholders, coverage ≥ 95 % — currently 100 %, nutrients,
  activities, units, on-demand loading, fallback, detection); e2e language switch (German, Somali,
  survives reload, restored backup in German); 200 % checks in de/fi. 138 unit, 97 Playwright and
  Lighthouse pass. Initial JS 34.4 KB gzip.
- Review fixes: CSV separator/decimal follow the locale (`;` + comma for sv/da/de/fi) with
  translated headers; the language pack is fetched in parallel with reading settings (last
  language remembered as a startup hint); each pack carries its own sync-screen strings; the last
  language chosen wins; Danish searches Swedish data by default; Somali falls back to an English
  locale where the browser lacks it.

## 2026-10-09 — M17b Pairing (interactive session)

Done:
- Settings → "Synka med en annan enhet": device A shows a QR code, B scans it (camera, or paste the
  code as text) and shows its answer, A scans that; the devices then sync directly and the app
  reloads. Fixed, translated messages for unreadable codes, version mismatch and no connection.
- `src/lib/pair.ts`: compressed codes (~600 characters → a QR a phone reads from a screen),
  WebRTC data channel with no STUN/TURN (same network only, nothing to third parties), messages in
  ~16 KB parts with back-pressure, protocol version check. QR rendering with `uqr` (MIT, lazy);
  scanning reuses the barcode scanner with the `qr_code` format.
- Sync strings live in `src/lib/strings-sync.ts`, loaded with the lazy screens (they cost 1 KB
  gzip in the first bundle otherwise). Privacy policy and data-safety notes cover sync.
- Tests: unit (codes, framing, protocol over an in-memory channel with 300+ records); e2e with two
  browser contexts syncing over a real WebRTC connection; garbled code refused; axe + 200 % on
  the sync screens. 126 unit, 92 Playwright and Lighthouse pass. Initial JS 36.8 KB gzip.
- Review fixes: camera permission is asked before creating a code (otherwise browsers put an
  mDNS name instead of the local address in it, which many phones/networks can't resolve);
  5 min to get the code scanned, 30 s to connect after; the final message is flushed and a close
  after it counts as success; changes go in batches of 500, applied as they arrive, with progress
  ("1 000 av 1 502"); cancel button; stale connections closed on retry; caps on incoming parts;
  smaller codes; honest error text once changes were saved. e2e syncs 1,500 records for real.

Not verified on real phones yet (the owner should try two phones on the same Wi-Fi): camera QR
scanning of the dense code, and networks that block device-to-device traffic.

## 2026-10-09 — M17a Sync engine (interactive session)

Done:
- IndexedDB v9 adds a `meta` store: every write/delete in `db.ts` records `{ mt, del? }` per record
  in the same transaction (tombstones for deletions). No record format or backup change.
- `src/lib/sync.ts` (lazy, not in the first bundle): `summarize` / `changesFor` / `applyChanges`.
  Newest change wins, ties keep the local copy; incoming records are validated with the backup
  validators (`SYNC_VALIDATORS`) and must match their key, or the sync aborts before any write.
- Review fixes: backup restore never resurrects deletions or overrides newer data (records keep
  their own time); "Radera all data" stays device-local (confirmation says paired devices keep
  their data); the v9 upgrade stamps existing records (summary reads only the log); remote change
  times capped at +5 min; tombstones pruned after 90 days; usage keeps the larger count; lang,
  sources and energyNotice stay per device; records read once per store; summary not computed twice.
- Design notes: docs/ARCHITECTURE.md → "Device-to-device sync".
- Tests: two simulated devices with separate databases syncing over a JSON wire — union, deletions
  don't return, conflicts in both directions, edit vs deletion, settings/water/pre-v9 records,
  invalid or mislabelled records rejected atomically, restores vs deletions, v8→v9 upgrade, clock
  cap, tombstone pruning, usage/settings merging, 3,000 records (0.7 s).
  120 unit, 84 Playwright and Lighthouse pass. Initial JS 36.7 KB gzip (+0.4 KB: change tracking).

## 2026-10-09 — M18a Accessibility audit (interactive session)

Done:
- `e2e/a11y.spec.ts`: axe-core (WCAG 2.1 A/AA rules) on the diary, search, food, nutrients,
  nutrient detail, body log with chart, settings, the activity/supplement/recipe sheets and the
  privacy/about pages — in light and dark mode. 0 violations (dev dependency @axe-core/playwright).
- 200 % text size (WCAG 1.4.4) at 360 px: long Swedish compounds ("Makronäringsämnen") widened the
  page, so mobile browsers zoomed out and the tab bar ended up partly off-screen. Headings, labels,
  paragraphs and food names now wrap/hyphenate (`overflow-wrap: break-word; hyphens: auto`).
- Review fixes: one test per screen (15 screens/sheets + 2 pages, each in light and dark), 200 % text on
  all of them, with CI's wide default font (DejaVu Sans) forced so local runs match CI (found and
  fixed: the tab bar's "Inställningar", card headers like "Mina livsmedel" whose button couldn't
  wrap, and long words/URLs on the static pages); local dates in tests; failure messages list up to 3 nodes with axe's summary;
  Lighthouse accessibility is now an error gate at ≥ 0.95.
- M18 split: languages (Danish, Finnish, German, Somali — the owner's choice; Norwegian dropped)
  move to M18b, with on-demand string loading and a manual screen-reader pass.

## 2026-10-09 — M19b decisions (interactive session)

- Android verification host: the free GitHub user site **Quoterg/Quoterg.github.io** (created; has
  `.nojekyll`, forwards `/` to the app with a plain meta refresh; checked 2026-10-09 that root and
  /iron-log/ return 200). Shared-origin rule (no scripts on the user site, no other Pages repos,
  SW scope stays /iron-log/) in android/README.md and CONTRIBUTING.md. No custom
  domain (cost) and no move to another host (users' on-device data is per origin).
  Package id stays `io.github.quoterg.ironlog`. Steps to finish: android/README.md.
- Play data safety: declare conservatively (barcode shared with Open Food Facts for app
  functionality; IP address explained; health data never leaves the device) — reasoning in
  docs/STORE-LISTING.md.

## 2026-10-09 — M20 Contribute back (interactive session)

Done:
- Scan finds nothing → link to Open Food Facts' "add product" page with the barcode; product
  without nutrition facts → link to its OFF page. Barcode products' detail pages link to OFF to
  correct or complete them. Everything happens on OFF's own website: no OFF credentials pass
  through Iron Log.
- Built-in foods (SLV/USDA): "Rapportera fel i livsmedelsdata" opens a prefilled GitHub issue
  (food, ref, source, what's wrong, correct value + source).
- CONTRIBUTING.md: food data (OFF, SLV/USDA errors, household measures, NNR rows), code setup,
  performance rules, translations, bug reports.
- In-app OFF upload (nutrition + photos via the OFF write API, needs an OFF login) split out as
  **M20b**.
- Review fixes: links use the looked-up code (not the editable field), `noreferrer`, hidden
  offline; reports include the English name and name the source from the ref; no report link for
  custom foods, recipes or scanned products (they have their own fix paths).
- Fixed a flaky e2e (supplements): it reloaded before IndexedDB had stored the change.
- Tests: 107 unit; e2e (Playwright) all pass incl. not found → OFF add link, no nutrition → OFF
  product link, OFF product → fix link, SLV food → report link, custom food → no report link.
  Initial JS 36.1 KB gzip (+0.5 KB: strings, link helpers in the food screen).

## 2026-10-09 — M19 App stores, prep (interactive session)

Done:
- `public/privacy.html` (sv + en): no accounts, no tracking, data only on the device; what goes
  over the network (app/data files from GitHub Pages; barcodes to Open Food Facts). Linked from
  Settings next to the privacy line, with `public/about.html`, a static landing page.
- `android/twa-manifest.json` (Bubblewrap) + `android/README.md`: build steps, signing key kept
  out of version control (.gitignore). **Blocker before publishing:** Digital Asset Links must be
  served at the origin root (`/.well-known/assetlinks.json`), which a project page under
  quoterg.github.io/iron-log/ can't do — needs a custom domain or a `Quoterg.github.io` user site.
- `docs/STORE-LISTING.md` (texts sv/en, category, rating, Play data-safety answers, graphics
  checklist) and `docs/FDROID.md` (TWA caveats; PWA install as the no-store path).
- Manifest: `id`, `categories`, a dedicated maskable icon (`icon-maskable-512.png`, full-bleed;
  artwork inside the safe zone). The service worker precaches both static pages (offline on
  first use). Privacy covers the camera (on-device only) and IP addresses seen by OFF/GitHub.
- Publishing is split out as **M19b** (domain + package id decision, assetlinks, Android project
  for F-Droid, first build) — needs the owner's decision on the domain.
- Tests: 104 unit, 31 Playwright (pages reachable in sv and en, `#en` targets, served as their own
  pages and not the app shell, available offline after the first app load). Initial JS 35.6 KB.

## 2026-10-09 — M16 More nutrients (interactive session)

Done:
- New nutrients, appended to `nutrients.json` (stored vectors keep their positions; shorter ones
  read as unknown): DPA (SLV + USDA), vitamin K (K1), pantothenic acid, biotin, copper, manganese
  (USDA only — SLV doesn't analyse them, so Swedish foods show them as unknown).
- NNR 2023 targets for the new vitamins/minerals (Helsedirektoratet tables 9–11; see
  docs/NNR-SOURCES.md), by sex, age band, pregnancy trimester and lactation.
- Data files leave out trailing unknown values (the worker pads rows to the file's `keys`):
  SLV +0.5 KB gzip for DPA, the six new columns cost ≈ nothing; USDA still 4 files < 190 KB.
- Nutrient detail page (tap a nutrient on the Nutrients tab): target, the period's top sources,
  and the 10 richest database foods per 100 g. Those come from `data/top.<hash>.json`
  (14 KB gzip, `scripts/build-top.mjs`, one-pass top-k), so the page never loads the databases.
  Run `pnpm data:build-top` after rebuilding SLV/USDA data (a unit test checks it's current).
- Vitamin K is K1 only in the data (labelled "Vitamin K (K1)"); K2-rich foods under-report.
- Foods without data for a nutrient: when no logged food reports it, the nutrient shows as
  unknown ("–"), not as a shortfall (M13 logic) — so SLV-only days show "–" for the new ones.
- Tests: 99 unit, 28 Playwright. Initial JS 35.5 KB gzip.

Not done (split out as M16b): amino acids.

## 2026-10-09 — M15 Supplements (interactive session)

Done:
- Supplements are custom foods with `supplement: { unit, perDay }`. Amounts are entered per unit
  (tablett, kapsel, ml…); one unit is stored as 1 g, so per-100 g = per-unit × 100 and logging,
  totals, reports, search and backups work unchanged. Backups validate the supplement field.
- Diary card "Kosttillskott": daily supplements (perDay > 0) get a checkbox that logs the daily
  dose (unticking removes the day's entries); as-needed ones (perDay 0) get "+1". Their entries
  show in this card, not under meals. Tapping a taken row opens the entry; otherwise the editor.
- Lazy supplement editor (3 KB): vitamins, minerals and EPA/DHA first, the rest behind "show all".
  Search shows a "Tillskott" badge.
- Tests: 97 unit, 28 Playwright. Initial JS 35.2 KB gzip (+0.9 KB; ≈ 5 KB headroom left).

- Review fixes: deleted supplements keep their history in the card (never moved to a meal);
  "edit food" for a supplement always opens the supplement editor, and saving keeps its
  supplement info; the name opens the editor and the taken amount opens the entry; unticking
  removes only the latest daily dose; CSV labels supplement rows "Kosttillskott"; nutrient inputs
  in the editor are uncontrolled (no re-render per keystroke).

Known limitations: the schedule is "units per day" only (M15b: weekdays, times). Entries are
stored under breakfast internally (shown in the supplement card and labelled in CSV). An app
version from before M15 importing a newer backup would treat supplements as plain foods (×100
values) — the PWA updates itself, so this only affects an old copy that was never reopened online.

## 2026-10-09 — M14 Activity (interactive session)

Done:
- Diary cards "Aktivitet" (exercise with burned kcal, × to remove) and "Vatten" (+2 dl, +5 dl,
  −2 dl, total in litres). IndexedDB v8: `activities` (index by date) and `water` (per day); both
  in backups (validated; water import keeps the larger daily total).
- Burned energy = (MET − 1) × weight × hours — energy on top of resting, which the daily energy
  need already includes. 27 activities with Compendium of Physical Activities (2024) MET values
  (`lib/activity-types.ts`, split out: loaded by the add sheet and by the diary only on days with
  activities). Profile weight is used; 70 kg assumed (and said) if missing.
- Optional "Lägg till förbränd energi i dagens energimål" (profile): the day's target grows by the
  burned energy and the diary says so.
- Add-activity sheet is lazy (0.7 KB gzip). Tests: 87 unit, 27 Playwright. Initial JS 34.2 KB gzip
  (≈ 6 KB headroom left — keep new first-screen code small or lazy).
- Review fixes: whole minutes validated as stored (0.4 min can't create an unrestorable backup);
  backups accept unknown activity ids (shown by id); water changes are one IndexedDB transaction.

Known limitations (deliberate, for now):
- "Add burned energy" raises only the diary's target for that day; reports and range views compare
  against the plain target.
- Import merges: water keeps the larger daily total (an older backup can undo a −2 dl correction);
  activities, like entries, are put back even if deleted since the backup.
- Water is not in the CSV export, and there is no water goal or unit setting yet.

## 2026-10-09 — M13 Reports & insights (interactive session)

Done:
- Nutrients tab: period chips Dagen / 7 dagar / 30 dagar (ending on the selected date). Periods
  show the **average per logged day** (days without entries aren't counted as zero) with "N av D
  dagar har registreringar".
- "Att tänka på" card (periods only — a half-logged day would flag everything): nutrients below
  70 % of target (worst first, tap → sources) and anything over its limit.
- Tap any nutrient → "Största källor" sheet (lazy, 0.6 KB gzip): top 10 foods for that nutrient
  in the period, amount and share.
- Logging streak ("Du har loggat N dagar i rad"), counting from yesterday if today is still empty;
  unique dates read via a key cursor on the date index (no entries loaded).
- `src/lib/report.ts` (pure): dailyTotals, averagePerDay, gaps, contributors, streak; uses entry
  snapshots for recipes. `db.entriesBetween` (index range), `db.loggedDates`.
- Review fixes (reviewer agent on PR #15): nutrients no logged food reports are "unknown" (shown
  as –, never a 0 % gap — `knownNutrients`); switching period clears the old numbers first; streak
  has a race guard and walks dates backwards from today with a reverse key cursor, stopping at the
  first gap (`recentLoggedDates`); the sources sheet reuses the period's entries (`periodCache`);
  report math memoised; over-limit list capped and tappable.
- Tests: 85 unit (+ unknown nutrients, DST streak, range/streak queries), 26 Playwright.
  Initial JS 32.9 KB gzip.

## 2026-10-09 — M12 Body log & charts (interactive session)

Done:
- "Kropp" tab (`BodyView.tsx`, lazy 2.7 KB gzip, prefetched at idle): log weight, body fat %,
  waist per day (IndexedDB v7 `body` store, in backups); saving the newest measurement updates
  the profile's weight/body fat (automatic energy follows).
- `LineChart.tsx`: hand-written SVG, one measure per chart (no dual axes), measurement dots
  (r 4 + 2 px surface ring) + 7-day time-window moving average (`lib/body.ts`, 2 px line), clean
  ticks (`niceScale`), recessive hairline grid, first/last dates; crosshair + readout on pointer and
  arrow keys; "Visa som tabell" table view. Colours validated with the dataviz palette checker:
  light #1f7a4d / #3b6fb6, dark #36a56f / #5f8bd0 (CSS tokens `--chart-trend`, `--chart-point`).
- Range chips 30 d / 90 d / 1 år / allt; the trend is computed over the full history.
- Review fixes (reviewer agent on PR #14): import keeps the newer body entry per day; future
  dates refused (form + `saveBody`); deleting the newest weigh-in falls back to the next newest
  for the profile; "today" refreshes on visibility change; long histories draw ≤ 240 dots
  (min/max per bucket), table rows render only when opened, nearest point by binary search,
  series/trends memoised; year on axis labels for spans > 300 days. Found while testing: the
  readout ↔ hint swap shifted the layout under the pointer (taps landed elsewhere) → fixed height.
- Tests: 78 unit (+ body state: profile fallback, future date, import precedence), 25 Playwright.
  Initial JS 31.3 KB gzip.

## 2026-10-09 — M11 Global food data (interactive session)

Done:
- `scripts/fetch-usda.mjs` + `scripts/build-usda.mjs`: USDA FoodData Central SR Legacy (2018-04) +
  Foundation (2026-04-30), public domain → 8,032 foods (de-duplicated by name, most complete /
  Foundation preferred) in `public/data/usda-*.json`; ≤ 3 household
  portions per food. Mapping: energy 1008→2048→2047; carbohydrates = by summation, else by
  difference − fibre (SLV reports *available* carbs); salt from sodium; vitamin A as RAE and
  niacin as preformed niacin (SLV: RE / niacin equivalents — small, documented differences).
- `src/lib/sources.json` (generated) lists data files per source. The worker loads a source only
  when it's enabled for search, or on demand when a diary entry references it.
- Setting "Livsmedelsdatabaser i sökningen" (Settings → general): default Swedish → Livsmedelsverket
  only, English → both; at least one stays on. "USDA" badge in search; source + attribution.
- Size check now applies the 250 KB budget to every data file.
- Review fixes (reviewer agent on PR #13): a source that fails to load (offline before first
  download) no longer breaks search — `allSettled`, results from loaded sources plus a
  "kunde inte laddas" hint, retried automatically; diary lookups only wait for the sources their
  refs need. Data files are content-hashed (`foods.<hash>.json`, `usda-<n>.<hash>.json`, via
  `scripts/data-files.mjs`) and cache-first in the service worker (cache v2) — no re-download per
  launch. USDA split into 4 files ≤ 190 KB (room for M16). Files load one at a time (memory); the
  worker loads and indexes at idle (`warm`), not on the first keystroke. Build logs dropped
  duplicates (139) and fails loudly on changed CSV columns; energy test pinned to ≤ 40 outliers.
- Tests: 71 unit, 23 Playwright (incl. USDA blocked → Swedish search + hint). Initial JS 30.4 KB gzip.

Known gaps: USDA names are English in both languages; English users download ~580 KB more food data
once (after first paint; cached afterwards).

## 2026-10-09 — M10 Recipes (interactive session)

Done:
- `src/lib/recipes.ts`: nutrition from ingredients ÷ finished weight (cooked weight if weighed,
  else the raw sum) → per 100 g; a nutrient is unknown only if no ingredient has it. Recipes are
  foods with "portion" and "hela receptet" measures.
- IndexedDB v6 `recipes` store with a nutrition **snapshot** (per100g, portionG, totalG), so recipes
  show and log at startup without loading the food database; recomputed on save. Soft delete.
  Included in backups (validated: ≤ 200 ingredients, servings 1–1000, ranges).
- `RecipeEditor.tsx` (lazy chunk, 1.5 KB gzip, prefetched when idle): name, servings, ingredients
  (added via search → food screen in "ingredient" mode with measures; tap a row to change the
  amount; × to remove), optional cooked weight, per-portion summary + all nutrients per portion.
  The draft is discarded when the editor closes. A recipe can't contain itself.
- Recipes in search ("Recept" badge), Settings → "Mina recept", create from a meal's search
  (continues to logging), "Redigera recept" from the food screen.
- Review fixes (reviewer agent on PR #12): logged recipe entries keep a nutrition snapshot
  (`Entry.snap`, used by totals/diary/CSV), so editing a recipe never rewrites past days; each
  ingredient stores a per-100 g snapshot and saving is blocked if any ingredient has no data;
  recipes can't be ingredients (worker `excludePrefix`, over-fetch); import keeps the newer
  recipe/custom food by `updatedAt`; short vectors padded; unsaved drafts are stashed in
  sessionStorage with restore/discard; `nav.backTo('recipe')`; fractional servings; one library
  sync at startup (`loadLibrary`); memoised editor nutrition.
- Tests: 69 unit, 20 Playwright (stable over --repeat-each=2). Initial JS 29.8 KB gzip.

Known gaps: custom foods still update past entries when edited (intended for fixing typos);
ingredient foods changed later are only picked up when the recipe is saved again.

## 2026-10-09 — M8.1 Energy formula = tdeecalculator.net (interactive session)

Owner request: energy need as on tdeecalculator.net.
- `bmr()`: Katch–McArdle (370 + 21.6 × lean mass) when body fat % is given, else Mifflin–St Jeor;
  TDEE = BMR × multiplier, whole kcal. Matches the site exactly for 4 recorded cases (unit tests).
- Activity levels are now the site's five (1.2 sedentary default for new profiles … 1.9 athlete).
  Settings got a `version` (2): older settings migrate once on load and are saved — unset level
  (= NNR 1.6) → moderate 1.55, others to the nearest level; if the automatic target changed, a
  one-time notice asks the user to check their activity level. Backups snap levels the same way.
- Manual energy input now steps by 1 kcal (automatic values are whole kcal, not tens).
- Profile gets an optional "Fettprocent" field (3–70 %, decimal) and shows which formula is used.
- NNR pregnancy/lactation energy is still added on top. Docs: docs/NNR-SOURCES.md → Energy.
- Tests: 61 unit, 18 Playwright (stable over --repeat-each=2; build + Lighthouse in CI).

## 2026-10-09 — M9 Target editor (interactive session)

Done:
- "Anpassa mål" sheet (`TargetEditor.tsx`, from the Nutrients tab and the profile): macro presets
  (NNR 2023, high protein 25–35 E% P, low carb 10–25 E% C, keto ≤ 5 E% C / 70–80 E% F, custom),
  custom E% ranges with grams shown, and min/max per nutrient (placeholders show the default incl.
  preset). Reset all. Energy stays in the profile.
- `targets.ts`: `computeTargets()` = NNR for the profile → macro preset → per-nutrient overrides;
  overrides are now `{ min?, max? }`; old `{ key: min }` settings and backups are migrated
  (`normalizeOverrides`). Backup validates preset and custom ranges.
- Performance (reviewer note on PR #8): Settings and the target editor are split out with a tiny
  `lazyView()` (no preact/compat) and prefetched when idle so the service worker caches them
  (offline e2e test). Initial JS 28.4 → 26.6 KB gzip.
- Review fixes (reviewer agent on PR #9): an override bound that contradicts a later preset is
  ignored and flagged (no "130 / 25 g"); rejected input shows a message; decimal comma in editor
  inputs; lazy screens show "try again" if a chunk fails to load offline; override values capped
  (`TARGET_MAX`) and prototype keys skipped on import; split chunks prefetch *after* the food
  database, Settings also on touch of its tab.
- Tests: 55 unit, 17 Playwright (run locally, stable over --repeat-each=2; also in CI).
  Initial JS 27.1 KB gzip.

## 2026-10-09 — M8 Profile-based targets (interactive session)

Done:
- Profile (Settings → Profil, `ProfileForm.tsx`): sex, age, weight (decimal), height, activity
  (PAL 1.4/1.6/1.8/2.0), life stage (pregnant T1–T3, breastfeeding), menstruating toggle,
  automatic energy.
- `targets.ts`: NNR 2023 values for 18–24 / 25–50 / 51–70 / 71+ and pregnancy/lactation; iron for
  women by menstruation (15 / 8 / 7 mg); protein 15–20 E% for >65. Sources and verification status
  per value: `docs/NNR-SOURCES.md`.
- Energy: Mifflin–St Jeor × PAL + pregnancy (+0.3/+1.2/+2.3 MJ, asks for weight *before* pregnancy)
  and exclusive breastfeeding (+2.0 MJ). Auto mode switches itself off when body data goes missing.
- Review fixes (reviewer agent on PR #8): PAL snapped to UI levels on import; integer age/height;
  decimal-comma weight; kcal input reverts invalid values (step 10); menstruation default resets
  when age crosses 51; backup profile validation tests; age-band boundary tests.
- Found via CI: the 2-column form grid overflowed 360 px phones (page zoomed out, controls
  overlapped) → `minmax(0,1fr)` columns + new `e2e/layout.spec.ts` asserting no horizontal overflow
  on every main screen. ScanSheet: a late "no camera" error could overwrite lookup messages →
  separate camera/lookup state. Playwright keeps traces of failures (CI artifact).
- Tests: 47 unit, 15 Playwright (stable over --repeat-each=3). Initial JS 28.4 KB gzip.

Known gaps: no values for under 18 (inputs start at 18; backups with age < 18 drop the age);
vitamin K/biotin/pantothenic acid not tracked yet (M16).

## 2026-10-09 — M7 Barcode scanning (interactive session) — Phase 1 complete

Done:
- `src/lib/off.ts`: EAN-8/UPC-A/EAN-13/GTIN-14 check-digit validation; Open Food Facts v2 lookup
  (`fields=` limited, 10 s timeout, CORS `*`); per-100 g mapping of 31 nutrients with unit
  conversion (OFF stores g), kcal from kJ fallback, salt↔sodium; "Name (Brand)"; serving and
  package size become measures ("portion", "förpackning").
- IndexedDB v5 `offFoods` cache: scanned products work offline, are searchable ("Streckkod"
  badge) and included in backups (validated).
- `ScanSheet.tsx`: camera with native `BarcodeDetector` when available, else lazily loaded
  `barcode-detector` ponyfill + zxing WASM (457 KB gzip) served from our origin
  (`zxing-wasm/reader/zxing_reader.wasm?url`, no CDN). ~4 scans/s; camera stopped on close.
  Manual entry always available; not found → create custom food.
- Tests: 33 unit, 13 Playwright incl. a real camera scan: Chromium fake camera plays a generated
  EAN-13 JPEG → WASM decodes it → product opens; asserts the .wasm came from our origin.
  Initial JS 26.3 KB gzip.

Ideas / known gaps:
- Cached OFF products are never refreshed (add "update from Open Food Facts" later).
- No `X-User-Agent` header (would add a CORS preflight on every lookup).

## 2026-10-09 — M6 Serving sizes (interactive session)

Done:
- `data/units.json`: 57 regex rules → approximate household measures (st, dl, msk, tsk, skiva,
  glas, kopp, portion, smörgås) for 349 SLV foods; emitted as `units` in foods.json (+1.5 KB gzip).
  Build warns on rules matching nothing; false positives (Mjölkchoklad, Smörgåstårta, Vattenmelon,
  croissant…) checked and excluded.
- Amount picker: quantity + measure select (g or "1 st (≈ 55 g)"), quick chips per unit (½, 1, 2, 3),
  "+ Eget mått" for user-defined measures (IndexedDB v4 store `servings`, included in backups).
- Entries store `unit`/`qty` alongside grams (grams stays the source of truth); diary shows "2 st".
  Last measure per food is remembered (usage.lastUnit/lastQty). Swapping an entry's food keeps the
  grams and drops the measure.
- Local tables (custom foods, usage, servings) now load before first render (removes startup races).
- Search: favourites/recent hide as soon as you type (no stale taps).
- Tests: 30 unit, 10 Playwright (verified stable with --repeat-each=3). Initial JS 23.0 KB gzip.

## 2026-10-09 — M5 Your data (interactive session)

Done:
- Settings → "Dina data" (`YourData.tsx`): export JSON backup, export diary CSV, import backup,
  storage-persistence status, delete all data, install button (Android `beforeinstallprompt`)
  and an iOS "Add to Home Screen" hint.
- `src/lib/backup.ts`: backup format `iron-log-backup` v1; strict validation (whole file rejected
  on any invalid item; newer versions rejected; invalid settings/unknown target keys dropped).
  Import = upsert in one transaction, then reload.
- CSV: one row per entry, all nutrients for the logged amount, unknown = empty cell; Swedish uses
  `;` + decimal comma, UTF-8 BOM for Excel; formula injection neutralised (`'=...`).
- Tests: 27 unit, 8 Playwright (export → delete all → import round trip; broken file rejected).
  Initial JS 21.7 KB gzip.

Note for M8/M9: when the profile/targets shape changes, update `settings()` in backup.ts.

## 2026-10-09 — M4 Fast re-logging (interactive session)

Done:
- IndexedDB v3 store `usage` (count, lastUsed, lastGrams, fav per food), seeded from the existing
  diary on upgrade (tested). Updated on every add.
- Search sheet before typing: "Favoriter" and "Senaste" (15 most recent). Food detail pre-fills
  the last amount used; ☆/★ favourite toggle.
- Ranking: `data/popular.txt` (59 everyday foods, exact SLV names; build warns on misses) →
  `popular` refs in foods.json → +2 boost; user history boost `min(3, 0.75·log2(1+count))` +2 for
  favourites, pushed to the worker and applied in place. Real-data test: "ris" → cooked rice,
  "mjölk" → Mjölk fett 3%, "ägg" → Ägg.
- Copy a meal or a whole day to another date/meal (`CopySheet.tsx`); the app then shows that day.
- Tests: 21 unit, 6 Playwright. Initial JS 19.1 KB gzip.

Ideas:
- Copied entries don't count as "uses" for ranking (deliberate for now).

## 2026-10-09 — M3 Food detail & custom foods (interactive session)

Done:
- Navigation: `src/nav.ts` — full-screen sheets as a stack mirrored in `history`, so the Android
  back button/gesture closes the top sheet. All sheets stay mounted (only the top shown), so going
  back restores e.g. the search query and results.
- Food detail (`FoodDetail.tsx`): amount, meal, all nutrients for the amount vs. targets
  (`NutrientGroups.tsx`, shared with the Nutrients tab), data source + license. Unknown values
  show "–", not 0. Tapping a diary entry opens it in edit mode: amount, meal, date, change food
  (search in replace mode), remove.
- Custom foods (`FoodEditor.tsx`, IndexedDB v2 store `customFoods`, refs `custom:<uuid>`):
  EU-label fields first, all 39 nutrients behind "show all"; empty kcal = estimated from macros
  (Atwater + 2 kcal/g fibre). Searchable in the worker with a small ranking boost and an "Eget"
  badge. Delete = soft delete: hidden from search, still shown in old diary entries. Listed under
  Settings → "Mina livsmedel". Creating from search continues straight to choosing the amount.
- DB upgrade v1 → v2 tested (existing entries kept). Worker isn't started early just to receive
  custom foods. Double-tap guard on add/save.
- Tests: 18 unit (incl. DB upgrade), 5 Playwright (custom-food lifecycle, entry move, back button,
  search kept on back, unknown nutrients). Initial JS 17.8 KB gzip; Lighthouse 100/100/100.

Known issues / ideas:
- Custom foods have one name (stored as `sv`), shown in both languages.
- Nutrients tab day totals still count unknown values as 0 (could show completeness per nutrient).

## 2026-10-09 — M2 CI & deploy (interactive session)

Done:
- `.github/workflows/ci.yml` on every PR and push to main: unit tests → build + size budget →
  Playwright smoke (Moto G4, 4× CPU) → Lighthouse CI; reports uploaded as the `reports` artifact.
- `.github/workflows/deploy.yml`: deploys to GitHub Pages only after CI succeeds on a push to `main`
  (workflow_run, checks out the tested SHA); manual `workflow_dispatch` also available.
- CI token is read-only; third-party `pnpm/action-setup` pinned by commit SHA.
  Live: https://quoterg.github.io/iron-log/
- `lighthouserc.json` gates: performance ≥ 0.9, FCP ≤ 1.8 s, LCP ≤ 2.5 s, TBT ≤ 200 ms, CLS ≤ 0.1.
  Local result: 100/100/100 (perf/a11y/best practices), FCP ~1.06 s, LCP ~1.2 s, TBT 0, CLS 0.
- README: CI/deploy badges and live link.

Ideas:
- Inline the 1.6 KB CSS into index.html to remove the one render-blocking request (FCP).

## 2026-10-09 — M1 Foundation (interactive session)

Done:
- Architecture decided: local-first PWA (Preact + signals, IndexedDB, worker search). See docs/ARCHITECTURE.md.
- `scripts/fetch-slv.mjs` → `data/raw/slv.json` (2,606 foods, sv + en names, ~58 nutrients).
  `scripts/build-foods.mjs` → `public/data/foods.json` (39 nutrients, 179 KB gzip).
- Search in a Web Worker: diacritic folding, prefix + Swedish compound matching
  ("kycklingfilé" → "Kyckling bröstfilé"). 140–150 ms round-trip on emulated Moto G4 at 4× CPU slowdown.
- Diary (4 meals, date navigation, edit grams, remove), nutrients view with NNR 2023 targets,
  settings (language, sex, kcal). Offline via `public/sw.js`. Decimal comma in Swedish.
- Budget: initial JS 15.2 KB gzip, CSS 1.6 KB, worker 0.9 KB, food data 179 KB.
- Tests: 14 Vitest unit tests (`pnpm test`), 2 Playwright smoke tests (`pnpm e2e`).

Known issues / ideas:
- "ris" ranks "Ris avorio okokt" (raw) above cooked rice → M4 ranking work.
- No PNG maskable icon variant; SVG used as maskable.
- `data/raw/` is git-ignored; run `pnpm data:fetch` to refresh from Livsmedelsverket.
