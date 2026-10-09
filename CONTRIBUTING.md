# Contributing to Iron Log

Thanks for helping! Iron Log is AGPL-3.0; contributions are accepted under the same license.

## Food data

- **Packaged products (barcodes)** come from [Open Food Facts](https://world.openfoodfacts.org),
  an open database anyone can edit. If a scan finds nothing, or a product lacks nutrition facts,
  the app links to the product on Open Food Facts — add it there (photos of the label and the
  nutrition table help most) and every Iron Log user finds it next time.
- **Swedish foods** come from Livsmedelsverket's food composition database and **US foods** from
  USDA FoodData Central. A wrong value? Use "Rapportera fel i livsmedelsdata" on the food in the
  app (it opens a prefilled GitHub issue), or open an issue with the food, the value shown and a
  source for the correct value. Errors in the source data are also reported upstream
  (Livsmedelsverket / USDA); we don't silently patch official data.
- **Household measures** (dl, msk, st) for Swedish foods live in `data/units.json` — corrections
  and additions welcome, with a source or a measured weight.
- **Nutrition targets** follow NNR 2023; see `docs/NNR-SOURCES.md` for where each value comes
  from. Checked a row against the printed tables? Say so in a PR and move it to the cross-checked
  table.

## Code

```sh
corepack enable && pnpm install
pnpm dev            # http://localhost:5173
pnpm test           # unit tests (Vitest)
pnpm build          # type check, build, size budget
pnpm e2e            # end-to-end on an emulated Moto G4 with 4× CPU throttle (after a build)
pnpm lighthouse     # Lighthouse CI on dist/ (mobile, slow 4G); gates in lighthouserc.json
```

Rules that keep the app fast on old phones (see `docs/ARCHITECTURE.md`):

- The first screen's JavaScript must stay under 40 KB gzip (`scripts/check-size.mjs` fails the
  build otherwise). New screens are lazy (`lazyView`), heavy work goes to the worker.
- Every user-visible string goes through `t()` (Swedish and English), numbers through `fmt()`.
- Data files are content-hashed and listed in `src/lib/sources.json`; rebuild them with the
  `data:*` scripts, then `pnpm data:build-top` (the nutrient page's precomputed top foods).
- Tests for logic (Vitest) and for user flows (Playwright) come with the change.
- The app shares the origin `https://quoterg.github.io` with the account's user site: never add
  scripts there, never enable Pages on other repos of the account, and keep the service-worker
  scope at `/iron-log/` (details: `android/README.md`).

## Translations

Swedish is built into `src/lib/i18n.ts`; every other language is a pack in `src/lib/lang/<code>.ts`
(UI strings, nutrient, activity and unit names, plus the `sync` and `off` screen strings), loaded
only when chosen. Danish, German, Finnish and Somali were machine-assisted and then reviewed by
the project owner — native speakers' improvements are very welcome: fix the wording in the pack.
A new language: copy `lang/en.ts`, translate, and add it to `Lang`, `LANGS`, `LOADERS` and
`LOCALES` in i18n.ts; `src/lib/i18n.test.ts` checks keys, placeholders (`{n}` etc.) and coverage.
Food names exist only in Swedish and English (`dataLangOf` in nutrients.ts picks which one a
language shows).

## Reporting bugs

Open an issue with what you did, what happened, and the device/browser. Please don't include
your exported data unless you've checked it contains nothing private.
