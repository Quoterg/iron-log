# Progress log

Newest first. Each weekly session adds one entry: what was done, what's next, open issues.
Keep entries short — this file is read at the start of every session.

## Next up

**M10 Recipes** (see docs/ROADMAP.md).

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
