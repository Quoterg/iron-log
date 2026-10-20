# Roadmap

Goal: a Cronometer-class, open-source nutrition tracker that is Swedish-first, works
everywhere, and stays fast on old low/mid-range phones (see [ARCHITECTURE.md](ARCHITECTURE.md)).

One milestone ≈ one weekly session (~5M tokens). If a milestone turns out larger, split it
(`M7a`, `M7b`) here and do the first part. Mark done with `[x]` and the PR number.
Status of the current work lives in [PROGRESS.md](../PROGRESS.md).

## Phase 1 — Usable daily tracker (Sweden)

- [x] **M1 Foundation** — Preact PWA, Livsmedelsverket data pipeline, worker search
  (diacritics + Swedish compounds), diary with meals, NNR 2023 targets, nutrients view,
  settings (sv/en, sex, kcal), offline service worker, size budget, unit + Playwright tests.
- [x] **M2 CI & deploy** — GitHub Actions: unit tests, build + size budget, Playwright smoke
  (Moto G4 + 4× CPU throttle) on PRs; deploy `main` to GitHub Pages; README badge + live link.
  Lighthouse CI gate (mobile, simulated slow 4G): performance ≥ 90, FCP ≤ 1.8 s, LCP ≤ 2.5 s,
  TBT ≤ 200 ms, CLS ≤ 0.1. (TTI no longer exists in Lighthouse; LCP + TBT replace it.)
- [x] **M3 Food detail & custom foods** — Food detail screen (all nutrients per 100 g and per
  chosen amount, source + license). Create/edit/delete custom foods (stored in IndexedDB,
  searchable alongside built-in foods, `custom:<uuid>` refs). Edit an entry's food/meal/date.
- [x] **M4 Fast re-logging** — Recent & frequent foods shown before typing; favourites; copy a
  meal or a whole day to another date; search ranking boosted by the user's own history.
  Rank everyday items first ("ris" → cooked rice before raw).
- [x] **M5 Your data** — Export/import everything (JSON backup + CSV of diary/nutrients),
  "storage is persistent" status, delete-all. Prompt to install to home screen (iOS hint).
- [x] **M6 Serving sizes** — Household units per food (st, dl, msk, tsk, portion, skiva) from a
  curated table for common SLV foods + user-defined servings; amount picker supports units.
- [x] **M7 Barcode scanning** — Open Food Facts lookup by barcode (typed or scanned), mapped to
  the nutrient vector, cached locally. Camera scanning via `BarcodeDetector` where available,
  lazily loaded WASM fallback (zxing-wasm) only when the scanner opens. Attribution (ODbL).

## Phase 2 — Cronometer depth

- [x] **M8 Profile-based targets** — Age, weight, height, body fat %, activity → energy need
  as on tdeecalculator.net (Katch–McArdle with body fat %, else Mifflin–St Jeor; activity
  1.2–1.9 — owner's choice, M8.1); NNR 2023 age bands (18–24, 25–50, 51–70, 71+),
  pregnancy/lactation, post-menopause iron. Unit tests against NNR tables.
- [x] **M9 Target editor** — Per-nutrient min/max overrides, macro targets in g or E%,
  presets (NNR default, high-protein, low-carb, keto), reset to defaults.
- [x] **M10 Recipes** — Recipes from ingredients, servings, cooked yield/weight change;
  log by serving or grams; recipe nutrient summary.
- [x] **M11 Global food data** — USDA FoodData Central (Foundation + SR Legacy, public domain)
  mapped to the same nutrient keys; data split per source and loaded by language/region
  setting; keep each file within budget; source badges in results.
- [x] **M12 Body log & charts** — Weight, body fat, waist; tiny hand-written SVG charts
  (no chart library); trend line (moving average).
- [x] **M13 Reports & insights** — Day/week/month averages per nutrient, "top contributors"
  for any nutrient, nutrient-gap highlights vs. targets, simple streaks.
- [x] **M14 Activity** — Exercise log (MET table, kcal burned), optional adding of burned
  energy to the day's target; water intake.
- [x] **M15 Supplements** — Supplements with per-unit nutrients, daily dose checklist, quick log.
- [x] **M15b Supplement schedules** — Weekdays and time of day for daily supplements. Reminders
  aren't possible for a web app without a server (browsers can't schedule notifications for a
  closed app), so the checklist itself is the reminder.
- [x] **M16 More nutrients** — Vitamin K, B5, biotin, copper, manganese (USDA) and DPA (SLV/USDA)
  with NNR 2023 targets; nutrient detail pages (target, your top sources, richest foods).
- [x] **M16b Amino acids** — The 9 essential amino acids (Met+Cys and Phe+Tyr combined) from USDA,
  targets per kg body weight (WHO/FAO/UNU 2007); low ones show up in the Nutrients tab's "worth a
  look" like any other nutrient.

## Phase 3 — Everywhere

- **M17 Sync** — **Decided (owner, 2026-10-09): device-to-device sync**: QR code + direct
  encrypted WebRTC connection between two of the user's devices, no server, no account. Own-cloud
  file sync or a server only later if needed. The app stays fully usable without it.
  - [x] **M17a Sync engine** — change tracking (`meta` store with tombstones, DB v9) on every
    write, transport-agnostic merge (newest change wins), validation of incoming records.
  - [x] **M17b Pairing** — "Synka" screen: QR offer/answer exchange (camera or pasted code),
    WebRTC data channel on the same network (no STUN server), messages split into parts (a first
    sync is several MB; data channels cap message size), progress, reload of state after sync.
- [x] **M18a Accessibility audit** — axe-core (WCAG 2.1 A/AA) in light and dark mode, and 200 %
  text size at 360 px without horizontal scrolling, on: diary (empty/first run), food search, food
  amount, edit entry, custom food editor, barcode scan, copy day, nutrients, nutrient detail,
  targets editor, body log with chart, settings (profile, sources, your data), activity sheet,
  supplement editor, recipe editor, privacy and about pages. Lighthouse accessibility ≥ 0.95 gates CI.
- [x] **M18b Languages** — Language packs loaded on demand (only Swedish in the first bundle);
  Danish, German, Finnish and Somali (machine-assisted, owner-reviewed) incl. nutrient, activity and unit
  names; locale-aware numbers and dates.
- [x] **M18c Language review** — Owner reviewed and approved da/de/fi/so (2026-10-09); "beta"
  labels removed.
- [ ] **M18d Screen-reader pass** — Manual TalkBack/VoiceOver walk-through of the main flows.
- [x] **M19 App stores (prep)** — Privacy policy, landing page, store listing texts, F-Droid
  notes, Bubblewrap config and build guide.
- [x] **M19b App stores (publish)**
  - Done: domain/package id decided (free user site quoterg.github.io serves the root; package
    `io.github.quoterg.ironlog`); data-safety answers decided (conservative, docs/STORE-LISTING.md).
  - Done (2026-10-09): first signed build by the owner (upload key kept by the owner);
    `https://quoterg.github.io/.well-known/assetlinks.json` live with its fingerprint, verified
    with Google's Digital Asset Links API; minSdk 24 (Android 7.0).
- [ ] **M19c Store listings (optional, owner's choice)** — Google Play (one-time fee) with Play App
  Signing, then add Play's app-signing fingerprint to assetlinks.json; and/or F-Droid (commit the
  generated Android project).
- [x] **M20 Contribute back (links only)** — Submit missing products/photos to Open Food Facts from the app;
  report data errors; contributor docs. (Done as links to OFF's own add/edit pages — no OFF
  credentials pass through the app — plus prefilled GitHub issues and CONTRIBUTING.md.)
- [x] **M20b In-app Open Food Facts upload** — From the scan flow: name, brand, the label's
  nutrition per 100 g and photos (front, nutrition table) go to Open Food Facts with the user's
  own OFF login (memory only, never stored); the product is then logged right away.
- [x] **M21a Content-Security-Policy** — S2 in docs/SECURITY-REVIEW.md: CSP meta tag in the app
  (production builds) and the static pages; an e2e walk through the main flows fails on any violation.
- [x] **M21b Security housekeeping (low)** — S4 bounds on sync input (smaller MAX_PARTS, summary
  size/values checked, batch count capped; tests), S5 supply chain (`--frozen-lockfile` in CLAUDE.md
  and docs/ROUTINE.md, dependabot for npm + actions, SECURITY.md).
- [ ] **M22 Own origin — deferred (owner decision, 2026-10-09)** — S1 in docs/SECURITY-REVIEW.md.
  The owner keeps `quoterg.github.io` for now with safeguards (2FA on; never rename/delete the
  account; no GitHub Pages on any other repo; user-site repo stays minimal — see CLAUDE.md). Revisit
  before promoting the app widely: then move to its own origin (free GitHub organization or own
  domain) with a "move my data" path and a new Android build. Don't start it without the owner.

## Phase 4 — Faster than the rest, and a coach when you want one

Owner decisions (2026-10-11): all of "logging in 3 seconds" (plan 1A); from the coaching plan the
adaptive energy expenditure, a shopping list, and a weekly check-in with recommendations. Anything
that adapts or advises (adaptive expenditure, swaps, recommendations, check-in) is **opt-in and
off by default** — the app
must never feel preachy. Everything stays on the device, lazy-loaded, within the size budget.

- [x] **M23 Meal templates & portion memory** — Save a logged meal as a named "saved meal" (rename,
  drop foods or remove it later, also from Settings) and log it in one tap; saved meals show in the
  add sheet before typing. Each food
  opens at the amount and unit you usually log; quick multipliers (½×, 1×, 1½×, 2×) in the amount
  picker. One-tap "same as yesterday" per meal (builds on the M4 copy sheet). Templates are part
  of backup and sync.
- [x] **M24 "Your usual" & shortcuts** — Suggest a whole meal only when it truly is the usual, never
  as noise. Rules (unit-tested, tune only with data): the same meal (≥ 80 % of its energy from the
  same foods) was logged in that meal slot on ≥ 4 of the last 6 comparable days (weekdays vs.
  weekends separately), it is the slot's time of day, and the meal is still empty today. One card
  at most, at the top of that meal; one tap logs it, the amount is editable afterwards. Dismissing
  hides it for the day; three dismissals in a row pause it for that slot for 14 days; an off switch
  in Settings. "Time of day" = around when the user logs that meal (1 h before to 1½ h after), else
  a default window. Plus home-screen shortcuts "Lägg till mat" (add sheet for the meal of the time
  of day) and "Vatten +2 dl" (web manifest `shortcuts`, and android/twa-manifest.json — the Android
  app gets them with the next Bubblewrap build). Water already has quick buttons in the diary.
- [x] **M25 Adaptive energy expenditure (opt-in)** — Off by default (Settings); many users prefer
  a constant calorie target, and with it off nothing changes and nothing is shown. When on, estimate real daily expenditure from the weight trend
  (M12 moving average) and logged intake over the last 2–4 weeks (≈ 7700 kcal per kg, smoothed;
  only days marked complete count — add a one-tap "day complete" mark to the diary, with days
  far below the user's typical intake treated as incomplete when unmarked; needs ≥ 10 such days and ≥ 3 weigh-ins, otherwise it says so).
  Shown with its uncertainty next to the formula-based value (M8). The user can choose to use it
  as their energy target, with a goal (lose / maintain / gain) and a pace capped at safe limits
  (never below a minimum intake, at most ~0.75 % body weight per week). Never changes targets by itself.
- [x] **M26 Weekly check-in (opt-in)** — Off by default; turned on in Settings. Once a week: averages,
  weight trend, adaptive expenditure and a suggested energy target (only if M25 is on) for the chosen goal (accept or
  ignore), what went well, and at most one recommendation to reach the goals (from M27's scoring).
  Neutral wording, no streak pressure or guilt, no notifications unless the user asks.
- [x] **M27 Gap fixer & swaps (opt-in)** — Off by default ("Suggestions" in Settings). For nutrients
  short over the period (only where the M13 coverage rule allows), suggest foods the user already
  eats, then Swedish staples, ranked by how much of the gap they cover per kcal; and swaps for
  frequently logged foods ("rye bread instead of white bread: +fibre, +iron"). Stays within NNR,
  no medical claims. A "what if" preview on the food detail (how today's bars would move) has its
  own switch, on by default since it is information, not advice.
- [x] **M28 Shopping list** — Build a list from templates, recipes and planned days (pick meals for
  the coming days); quantities summed per food and rounded to shop-friendly units, grouped by
  store section; tick off items, share as plain text. Stored locally, part of backup and sync.

## Phase 5 — Look and feel

- [x] **M29 Hologram theme: "Natt" and "Dag"** — Owner's choice (2026-10-11). The approved mockups
  of every main screen in both themes (Dagbok, Näringsämnen, Kropp, Inställningar, Lägg till mat)
  are on the design canvas (https://claude.ai/artifact/FWjxwKoTNUpi9BN3bLFV25, rows "M29 theme").
  Natt = Hologram: near-black #050912, teal/violet glows, translucent glass cards with thin teal
  borders, large light-weight numbers, floating pill tab bar, violet "Som vanligt". Dag = Daylight:
  pearl #eef1f8, white frosted cards, the same glows softer, near-black primary buttons.
  - Both as colour tokens in styles.css (they replace today's light/dark sets) plus the new
    shapes: card radius/borders, pill nav, segmented controls, big-number type. Every screen and
    sheet, not just the diary; charts (LineChart, bars) take the theme colours.
  - Setting "Utseende": Auto (follows the phone) / Dag / Natt, device-local like the language,
    applied before first paint (no flash), also in the web manifest's theme colours.
  - Fast on old phones: no backdrop-filter or filter: blur — the glows are radial gradients drawn
    once on a fixed background layer, glass is plain rgba. System fonts (no web font download).
  - Contrast ≥ 4.5:1 on glass in both themes (axe e2e in Dag and Natt, 200 % text); CSS stays
    within 8 KB gzip, initial JS unchanged within ±0.3 KB; Lighthouse unchanged.
- [x] **M30 Shopping list: prices and biggest items** — Owner's choice (2026-10-13). The list restocks
  from what was eaten in the last 7 days (planned days ahead only when there are any). Per line a
  "Pris" editor takes the shelf's comparison price (kr/kg, kr/l via the food's density, kr/st via its
  piece weight), remembered per food as kr/kg (new synced store `prices`); own items take a price in
  kr. Estimated total ("~420 kr · 3 utan pris") and a "Största posterna" view: lines by cost with
  their share of the total.
- [x] **M31 Offer links** — For the biggest items, one tap opens a chosen store's own search for the
  item (Willys, Hemköp, Coop, Lidl, City Gross search pages; ICA's offers page — its search needs a
  store). The user picks their chains (synced setting). The app fetches nothing: links open the
  store's site with the item's name (privacy page says so).
- [x] **M32 What's new** — The app gets a version (package.json) and a changelog (`src/changelog.ts`,
  every language). After a release, the first start shows "Nyheter i <version>" once; a fresh
  install shows nothing; minor web deploys without a version bump show nothing. Releasing = bump the
  version and add its entry (rule in CLAUDE.md).
- [x] **M33 Typical prices, updated twice a year** — Owner's choice (2026-10-13). A bundled table of
  typical Swedish prices (kr/kg) for Livsmedelsverket's foods, used where the user typed no price.
  - **Coverage check first** (as planned): Open Prices has ~5 200 SEK prices but no meat, fish or
    eggs, and is skewed to a few contributors' baskets. Owner's choice: a **hand-made base list** of
    ~200 shelf prices instead (`scripts/prices-spec.mjs` + `data/prices-base.json`: willys.se
    comparison prices, median of the matching products, compiled by hand once a year with
    `pnpm data:base-prices`). Open Prices replaces a shelf price only with ≥ 3 prices from ≥ 2 stores
    in 12 months **and** within ×1.5 of it (22 items today).
  - **Spread to the foods** with Livsmedelsverket's own data (raw commodities per food, with raw
    weights): a food named by an item gets its price; cooked foods of raw-priced items by the raw
    weight in them (cooked pasta = 50 g dry per 100 g); other raw foods and home-style dishes summed
    from their raw commodities when ≥ 90 % of the raw weight has a price; industrial products only
    by a shelf price. Result: **2 364 of 2 606 foods** (all 59 popular ones), 8.9 KB gzip.
  - **Kept current** by SCB's consumer price index per food group (CC0, monthly, 85 groups): a
    scheduled workflow (`.github/workflows/prices.yml`, 1 March and 1 September) refetches, rebuilds,
    runs the unit tests (including sanity checks of the table) and opens a PR "Prices: …", starting
    CI on it; it fails if coverage drops > 10 % and reminds when the shelf prices are ~a year old.
  - **App**: setting "Visa uppskattade priser (typpriser)" in Settings → Matkostnad (off by default,
    synced, in backups). On: the shopping list prices lines without an own price as "≈ 18 kr", the
    total says how much is typical prices, and the price editor shows "≈ typpris … kr/kg". The table
    is lazy (fetched when on, prefetched when idle for offline). Sources credited in Settings and on
    the about/privacy pages; nothing is fetched from shops.
- [x] **M34 Cost per food and meal in the diary** — Owner's choice (2026-10-13), after M33. Setting
  "Visa matkostnad" (Settings, **off by default**, synced like the other opt-ins) turns on M33's
  typical prices and shows costs in the diary:
  - each entry: "~4 kr" next to its energy (own price > typical price; recipes add up their
    ingredients; foods with no price show nothing);
  - each meal: total in its header ("Frukost · ~23 kr"; "minst ~23 kr" when some entries lack a
    price), and the day's total under the day summary;
  - tapping a cost opens the food's price editor (the same one as the shopping list), so a wrong
    estimate is fixed in one place.
  - Performance: when the setting is off nothing extra loads; when on, the price table loads after
    first paint and costs appear when ready. Initial JS within +0.4 KB; Lighthouse unchanged.
  - Tests: unit (cost per entry, recipes, units, missing prices, the typical/own precedence), e2e
    (off by default; on → entry and meal costs; editing a price updates them; off again hides
    them), axe and 200 % text with costs shown.

- [x] **M35 Goal in the profile; follow the estimate** — Owner's choice (2026-10-13). The goal
  (Gå ner / Behålla / Gå upp) and pace (0.25–0.75 kg/week, ≤ 0.75 % of body weight per week) move
  from the adaptive card into the profile, next to the energy target, always visible:
  - the automatic (formula) target follows the goal: need ± pace × 7700 / 7 (0.5 kg/week = 550
    kcal/day), never below 1200/1500 kcal or the basal rate; no goal while pregnant/breastfeeding;
  - the adaptive card shows the measured expenditure and the target for that goal ("Använd");
  - **"Följ uppskattningen automatiskt"** (opt-in): once per ISO week (synced, so once per user) the
    target moves toward the adaptive suggestion by **at most ±150 kcal**, never below the floor; the
    diary shows "Energimålet följer din förbrukning: nu 2 430 kcal/dag (+150)" that week. Nothing
    happens until the estimate has enough data (10 days, 3 weigh-ins over 14 days).
- [x] **M36 Find scanned products again** — Owner's choice (2026-10-15; options 1 and 2 of 5). Scanned
  products were findable only by their Open Food Facts name and dropped out of "Senaste" (15):
  - **"Skannade varor (n)"** in the food search, before typing: every scanned product, most recently
    used first (collapsed until tapped);
  - **search by what is on the package**: generic name, the most specific categories, all brands and
    the barcode (any part of it, e.g. its last digits) are indexed as search words (`Food.terms`);
    products scanned before M36 are found by their barcode (their other words come with a new scan).
  - Later options, not done: own names for products, "Mina livsmedel" (all logged foods), scan to
    find offline first.
- [ ] **M37 Veckomenyn** — Owner's choice (2026-10-15). **Wait for the owner's go before starting.**
  "Make me a week from foods I actually eat that hits my targets and budget": a meal plan for 1–7
  days built from the user's own history, saved meals and recipes, then sent to the shopping list.
  - **Input** (a small sheet, from the diary and the shopping list): days (1–7), which meals, energy
    target (the profile's, goal included), budget per week in kr (optional, uses M33/M34 prices),
    nutrients to prioritise (default: those the user is often low in, from the reports), foods to
    avoid; "use only foods I have logged" on by default.
  - **Building it** (in the worker, lazy): candidate foods = the user's logged foods + saved meals +
    recipes from the last ~90 days, with their usual portion and meal; a small linear/integer
    optimisation (own simplex/branch-and-bound, no library, a few KB) picks portions per meal that
    meet energy (±5 %) and protein, reach NNR recommended intakes for the chosen nutrients, stay
    under the budget and within the upper limits, and varies the days (a food at most N times a
    week, meals look like the user's real meals — breakfast foods for breakfast). Falls back to the
    closest plan when no plan meets everything, and says which targets it couldn't reach and why.
  - **Result**: day by day, meal by meal, with kcal, cost per day/week and the nutrients reached
    (bars as in the reports); swap any item ("byt", next-best food for that slot) or lock it and
    re-plan; "Lägg i dagboken" puts a day as planned entries; "Till inköpslistan" adds the week.
  - Nothing leaves the device; no new network requests. Fast on old phones: the candidate list is
    hundreds of foods, not the whole database; target < 1 s for 7 days on a Moto G4 profile (CPU ×4).
  - Tests: unit (solver on small known problems; constraints met; infeasible case explained; budget;
    variety), e2e (plan a 3-day menu from a seeded history → targets shown, swap, to the shopping list,
    to the diary), axe and 200 % text; size: initial JS unchanged (all lazy).
- [x] **M38 Food cost in the summaries** — Owner's choice (2026-10-15).
  For users with Matkostnad on (M33/M34), cost joins the existing summaries — no new screen:
  - **Näringsämnen tab, 7 and 30 days:** "Matkostnad i snitt: ~62 kr/dag · ~434 kr/vecka" (30 days
    also "· ~1 860 kr/månad") — averages per logged day (as the nutrient averages), and that average
    for a week/month, not sums of the period; "(minst …)" when some foods have no price.
  - **Weekly check-in:** "Maten kostade ~430 kr förra veckan (~62 kr/dag), +5 % mot veckan innan."
  - Same prices as the diary (own > typical, recipes by ingredients); computed in the lazy cost
    chunk, nothing in the first bundle; hidden when Matkostnad is off.
  - Tests: unit (week/30-day sums and averages, partial, unlogged days), e2e (off → nothing; on →
    7/30-day lines, check-in line with the change against the week before).

## Phase 6 — Faster (M39)

Owner's choice (2026-10-15): five ways to make the app faster without losing anything, measured on the
emulated Moto G4 (CPU ×4) by `e2e/perf.spec.ts` (test-results/perf.json).

- [x] **M39a Snabbare: measure, start from the phone, smaller first bundle** —
  - Timing marks (`il:render`, `il:day`) and `e2e/perf.spec.ts`: cold start, warm start, warm start
    with the app page 2 s late (a poor connection), first search. Routes see the service worker's
    fetches (`PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS`, playwright.config.ts).
  - **Pages cache-first** (sw.js): a start never waits for the network; a new version is fetched in
    the background, used at the next start, and offered as "Ny version – Starta om" (asked for by the
    app once it listens, so the message isn't lost). Offline start unchanged. Measured: warm start
    with a slow connection **~2 110 ms → ~115 ms** to the diary.
  - **Smaller first bundle:** the food detail and Näringsämnen screens load right after start (with
    the other split-out screens) instead of in it: initial JS **38.3 → 34.8 KB**.
- [x] **M39b Snabbare, part 2** — measured first (perf.spec.ts now also: a logged day, a search right
  after start, the start's steps), then only what measurably helps:
  - **Done (a):** the 229 Swedish strings only later screens use moved from i18n.ts to
    `strings-later.ts`, loaded with every lazy screen (lazy.tsx) and by the one other module that
    needs them; `strings-split.test.ts` guards the split from the import graph. **Initial JS 34.9 →
    30.4 KB.** Lighthouse (median of 3): FCP 1 253 → 1 189 ms, TTI 1 646 → 1 570 ms, TBT 58 → 37 ms,
    script start-up 174 → 125 ms.
  - **Not done, by measurement:** (b) diary before the library — reading it takes ~5–40 ms;
    (c) build-time food data/index — a search right after start already answers in ~190 ms (80 ms
    of it the typing pause) and a columnar layout is only 11–15 % smaller while every existing user
    would download the data again; (d) diary/report rendering — no stutter measured. Revisit if the
    numbers change.

## Phase 7 — Fruit in season (M40)

- [x] **M40 Frukt i säsong** — Owner's choice (2026-10-21: ideas 2 + 3, automated, not hand-made;
  with the amount for a week). Opt-in (Settings → Förslag), a card in Näringsämnen (7/30 days):
  - **Seasons from official statistics**, no hand-made calendar (`pnpm data:fetch-fruit` /
    `data:build-fruit`, run with the prices on 1 March and 1 September): SCB's monthly imports by
    product code and sending country (ImpTotalKNMan), averaged per month over 3 years; Swedish fruit
    from Jordbruksverket (yearly harvests JO0102R21/R11, spread over the months Swedish growers sold
    it by the monthly producer prices JO1001L2: strawberries Jun–Aug, apples Aug–Jun). Fruit sent on
    by a European trade hub (mango via the Netherlands) counts as from outside Europe: share
    min(1, the country's imports from outside the EU ÷ its exports) that month (Eurostat Comext).
    In season = ≥ 40 % of the fruit's best month, ≥ 100 t, and the allowed origins ≥ 20 % (Swedish)
    / 30 % (Europe) of what's in the shops. Table `src/lib/fruit-season.json` (~2 KB gzip, lazy).
  - **From where (idea 3):** Svenskt / Sverige + Europa (default) / Hela världen; each fruit shows
    "svensk", "mest från Spanien" or "längre ifrån".
  - **Week's amount:** goals = gaps in vitamins, minerals and fibre that some fruit in season helps
    with, most important first (shortfall × 1.3 for NNR's Nordic concern nutrients); chosen by default:
    the most important that a week of fruit closes at least halfway (≤ 3; any can be picked). Whole
    portions (st/dl), per kcal, ≤ 1 portion of a fruit a day, ≤ 4 kinds, ≤ 1 750 g a week; says how
    much of each goal it covers, when fruit alone isn't enough, and the week's cost (Matkostnad on).
  - Not done: wild Swedish berries (no statistics), Swedish pears/plums by month (no monthly data —
    pears borrow the apple months), fruit names in da/de/fi/so (English, like food names).

## Later — ideas, not scheduled

Owner's call (2026-10-15): not relevant at this stage; kept here so the thinking isn't lost.

- **Athlete option (was M39 "Träningsdagar")** — an opt-in mode for people who train a lot:
  training/rest-day energy targets (the weekly total stays the same, carbohydrates carry most of the
  shift; a choice next to today's "Lägg till förbränd energi"), protein per main meal (~0.3–0.4 g/kg),
  a training-day card with the user's own foods before/after longer sessions; training days from
  logged activities (≥ 20 min) and an optional weekly schedule. Initial JS ≈ +0.2 KB, the rest lazy.

