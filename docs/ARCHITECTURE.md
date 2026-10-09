# Architecture

## Requirements that drive the decision

1. **Fast on old, low/mid-range phones** (reference device: Android 8–10, 2–3 GB RAM,
   Cortex-A53 class CPU, e.g. Moto G6 / Samsung A10; iOS 15+ Safari). Slow 3G must work.
2. **Sweden first, global second**: Swedish UI and the Livsmedelsverket food database by
   default; English UI and USDA FoodData Central for everyone else; Open Food Facts for barcodes
   (strong Nordic coverage). Metric units, decimal comma in `sv`, NNR 2023 reference intakes.
3. **Micronutrients are first-class** (Cronometer-level), not an afterthought.
4. **Open source, cheap to run**: no mandatory server, no account required, data owned by user.
5. **Built incrementally by weekly AI sessions** with a fixed token budget → simple, conventional
   code, few moving parts, one language.

## The five candidates

| # | Architecture | Speed on old phones | Offline | Reach | Cost to build | Cost to run |
|---|---|---|---|---|---|---|
| A | **Native apps** (Kotlin/Compose + Swift/SwiftUI) + REST backend | ★★★★★ | ★★★★ | Store installs only, two codebases | Very high (2× everything) | Server |
| B | **React Native / Expo** + Node/Postgres backend | ★★★ (Hermes helps, but JS bridge + RN runtime ~7 MB; janky lists on A53) | ★★★ | iOS + Android, store installs | Medium | Server |
| C | **Flutter** + Firebase/Supabase | ★★★★ (AOT, smooth), but 15–20 MB APK, heavy RAM; web build is slow (2 MB+ CanvasKit) | ★★★ | iOS + Android (+ weak web) | Medium | Vendor backend |
| D | **Server-rendered** (FastAPI/Django + HTMX), thin client | ★★★★ on device, but every tap is a network round trip — bad on Swedish rural/underground 3G | ★ | Any browser | Low | Server + DB per user |
| E | **Local-first PWA**: Preact + TypeScript, IndexedDB, static food DB shipped as compressed data, search in a Web Worker, optional self-hostable sync later | ★★★★ (≈ 30 KB JS initial; no network on the hot path) | ★★★★★ | Any phone browser, installable, no store needed; can be wrapped later (TWA/Capacitor) | Low–medium | Static hosting (GitHub Pages, free) |

## Decision: **E — local-first PWA**

Why it wins for this project:

- **Speed where it matters.** The slow part of every tracker is "search food → log it".
  In E that path is entirely local: the food index is preloaded into a Web Worker, search
  runs in < 10 ms over ~10k foods even on an A53, and logging is a single IndexedDB write.
  Native (A) is only marginally faster for this workload while costing 2× to build.
- **Tiny footprint.** Preact (4 KB) + signals instead of React (45 KB) / RN / Flutter runtimes.
  Performance budget enforced in CI (see below).
- **No server needed.** Data stays on the phone; hosting is free static files. That is also
  the strongest privacy story (GDPR-friendly by default — relevant in Sweden/EU).
- **Reach.** Works on any phone with a browser from the last ~6 years, no app store gatekeeping;
  a Play Store build is a thin Trusted Web Activity wrapper later.
- **AI-buildable.** One language (TypeScript), one build tool (Vite), no infra.

Accepted trade-offs and mitigations:

- *iOS may evict PWA storage* → "Add to Home Screen" prompt + `navigator.storage.persist()`
  + one-tap export/import (M5) + optional sync (M14).
- *Camera barcode scanning in browsers* → native `BarcodeDetector` where present (Chrome Android),
  lazily loaded WASM fallback (zxing) only when the scanner is opened.
- *Multi-device* → optional end-to-end-encrypted sync server, self-hostable, later milestone.

## Stack

| Concern | Choice |
|---|---|
| UI | Preact 10 + @preact/signals, TypeScript, plain CSS (no UI framework) |
| Build | Vite, target `es2019` (Chrome 80+/Safari 14+) |
| User data | IndexedDB via `idb` (~1 KB) |
| Food data | Pre-built at build time from Livsmedelsverket (CC BY 4.0), USDA FDC (public domain); columnar JSON, gzip/brotli by host, cached by the service worker |
| Search | Web Worker, normalised (diacritic-folded, sv/en) prefix + token matching, ranked |
| Barcodes | Open Food Facts API (ODbL), cached locally |
| Offline | Hand-written service worker (no Workbox — keeps it small) |
| i18n | Tiny in-house `t()` with `sv` / `en` dictionaries, `Intl.NumberFormat` |
| Targets | NNR 2023 (Nordic Nutrition Recommendations) by sex/age; user-overridable |
| Tests | Vitest (logic), Playwright smoke test (later) |
| Hosting | GitHub Pages via GitHub Actions |

## Performance budget (enforced by `pnpm check:size`)

- Initial JS ≤ **40 KB gzip**; initial CSS ≤ 8 KB gzip.
- Food index (names + macros) ≤ **250 KB gzip**, loaded after first paint, then cached.
- Detailed nutrient table loaded lazily per food-chunk.
- Time-to-interactive < 2.5 s on Moto G4 / Slow 4G (Lighthouse mobile preset) — checked from M6.
- No layout libraries, no icon fonts (inline SVG), no runtime CSS-in-JS.

## Data model (user data, IndexedDB)

- `entries` — `{id, date: 'YYYY-MM-DD', meal, foodRef, grams, createdAt}`
  where `foodRef` = `slv:123` | `usda:456` | `off:<barcode>` | `custom:<uuid>` | `recipe:<uuid>`.
- `customFoods`, `recipes`, `offCache` — user-created or cached foods with the same nutrient vector.
- `settings` — profile, language, targets.

Nutrients are stored as a fixed-order vector keyed by EuroFIR component codes
(`src/lib/nutrients.ts`), so every food source maps into one shape.

## Device-to-device sync (M17)

The owner's choice (2026-10-09): no server, no account. Two of the user's devices connect directly
(WebRTC; pairing by QR code in M17b) and exchange changes; nothing is stored anywhere else.

- **Change log (`meta` store, DB v9).** Every write and delete in `src/lib/db.ts` also writes
  `meta[`${store}:${key}`] = { mt, del? }` in the same transaction — `mt` is the change time,
  `del` a tombstone so deletions sync instead of records coming back. The v9 upgrade stamps all
  existing records, so the log covers everything. Record formats (and backups) are unchanged.
- **Engine (`src/lib/sync.ts`, lazy).** Both devices send a summary read from the log (key → mt),
  then each sends what the other lacks or has older (records read once per store); applying keeps
  whichever change is newest. Ties keep the local copy, record or deletion alike. Incoming records
  go through the backup validators and must match their key; anything invalid aborts the sync
  before a single write. Change times from the other device are capped at 5 minutes ahead.
- **Merge details.** `usage` keeps the larger count (counts add up on both devices). Settings sync,
  except the device-local `lang`, `sources` and `energyNotice`.
- **Tombstones** are pruned after 90 days. Trade-off: a device that hasn't synced for longer can
  bring back records deleted elsewhere.
- **Backup restore** only adds missing records (or newer versions of recipes, custom foods, body
  entries) and never writes over a later deletion; restored records keep their own time, so an
  old backup can't override newer data on a paired device. Restored settings count as a change now.
- **"Radera all data" is device-local**: it clears the log too, so a later sync copies the paired
  device's data back. Wiping a phone before giving it away must never delete the data on the
  user's other devices; the confirmation says so.
- **Wire size.** A first sync is one big `changes` message (a year of history: a few MB); M17b's
  transport splits messages into parts below the data-channel message limit.
