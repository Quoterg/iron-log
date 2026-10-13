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
- [ ] **M21b Security housekeeping (low)** — S4 bounds on sync input (smaller MAX_PARTS, summary
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
- [ ] **M33 Typical prices, updated twice a year** — Owner's choice (2026-10-13). Wait for the owner's
  go before starting. A bundled table of typical Swedish prices (kr/kg) for common foods, so costs
  work before the user types any price. Research (2026-10-13): SCB publishes **no average prices in
  kronor** any more, only the consumer price index, including a monthly index for 97 food groups
  (table `PR0101A/KPI2020EPG01M`: Gryn, Ris, Mjöl, Mjukt bröd, …). So two open sources are combined:
  - **Kronor:** Open Food Facts' **Open Prices** (prices.openfoodfacts.org, ODbL; ~5 200 SEK prices
    from Swedish stores, per product with barcode and pack size → kr/kg). **No fixed number of
    foods:** every food the data supports gets a price. A map of **base foods** (Open Food Facts
    categories ↔ SCB group) takes the median kr/kg of the last 12 months, needing ≥ 3 prices from
    ≥ 2 stores; outliers trimmed. Base foods are as many as reach that bar (expected: a few hundred).
  - **Spreading base prices over Livsmedelsverket's ~2 600 foods**, so most of what people log is
    covered (goal: well over 1 000 foods):
    - *Variants* share their base food's price ("Mjölk 3 %", "Mjölk 1,5 %", "Mjölk berikad" → milk;
      likewise cheeses, breads, minced meats), by rules on Livsmedelsverket's names and groups plus
      a short hand-made list of exceptions.
    - *Cooked/prepared foods* use the raw food's price adjusted for weight change (cooked pasta
      ≈ 2,5 × dry weight → 40 % of the dry price per 100 g; rice, potatoes, fried chicken, …), using
      Livsmedelsverket's yield factors where given, else a small table.
    - *Recipes* add up their ingredients (M34).
    - Foods with no reliable price show nothing rather than a guess; own prices work for any food.
  - **First step, before building the app side:** measure coverage (base foods reaching the bar,
    Livsmedelsverket foods covered, share of the owner's logged foods covered) and report the numbers
    to the owner.
  - **Keeping it current:** SCB's group index moves each price from the month it was observed to
    the latest month, and fills foods with too few recent prices from their last value (marked
    with its age; dropped after 2 years). Check SCB's licence terms before use (open data; keep the
    attribution in Settings either way).
  - Pipeline `pnpm data:fetch-prices` + `data:build-prices` → `public/data/prices-se.json` (a few
    KB, with the month it is valid for); loaded lazily, only when prices are used. Nothing is
    fetched by the app at runtime.
  - **Updates every 6 months:** a scheduled GitHub Actions workflow (1 March and 1 September, after
    SCB's January/July figures) runs fetch + build and opens a PR "Prices <month>" with a summary
    (foods covered, biggest changes); it fails visibly if coverage drops by more than 10 % from the previous table. Needs the
    owner to allow "GitHub Actions to create pull requests" in the repo settings once. The PR is
    reviewed and merged like any other; no version bump needed (data only).
  - **Shopping list:** lines without an own price use the typical price, shown as "≈ 18 kr" and
    "≈ typpris" in the editor; own prices always win. The total says how much is estimated.
  - Off by default, behind the M34 setting. Attribution (Open Food Facts Open Prices, SCB) in
    Settings and on the privacy/about pages.
- [ ] **M34 Cost per food and meal in the diary** — Owner's choice (2026-10-13), after M33. Setting
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
