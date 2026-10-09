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
