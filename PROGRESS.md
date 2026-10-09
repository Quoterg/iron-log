# Progress log

Newest first. Each weekly session adds one entry: what was done, what's next, open issues.
Keep entries short — this file is read at the start of every session.

## Next up

**M16b Amino acids**, then **M17** (see docs/ROADMAP.md).

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
- Tests: unit (link building, encoding), e2e (scan not found → OFF link; report link on an SLV
  food). Initial JS 36.1 KB gzip (+0.5 KB: strings, link helpers in the food screen).

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
