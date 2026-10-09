# Iron Log

[![CI](https://github.com/Quoterg/iron-log/actions/workflows/ci.yml/badge.svg)](https://github.com/Quoterg/iron-log/actions/workflows/ci.yml)
[![Deploy](https://github.com/Quoterg/iron-log/actions/workflows/deploy.yml/badge.svg)](https://github.com/Quoterg/iron-log/actions/workflows/deploy.yml)

**Try it: https://quoterg.github.io/iron-log/** — or install it:

- **iPhone:** open the link in Safari → Share → *Add to Home Screen*.
- **Android:** open it in Chrome → ⋮ → *Install app*, or download the **[Android app (APK)](https://github.com/Quoterg/iron-log/releases/latest/download/iron-log.apk)**
  from the [latest release](https://github.com/Quoterg/iron-log/releases/latest) (Android 7+; tap
  *More details → Install anyway* at the Play Protect warning — it isn't on Google Play). Only
  download it from here. Signing certificate SHA-256:
  `F9:FF:C7:18:F1:E9:E9:F7:C2:F0:94:53:ED:8E:FB:D5:7C:39:F3:DF:C5:6A:1E:D2:E8:0C:0B:E0:19:23:DC:4F`

Open-source nutrition tracker for energy, macros **and micronutrients** — a free alternative
to Cronometer and MyFitnessPal. Swedish first (Livsmedelsverket's food database and the Nordic
Nutrition Recommendations 2023), in Swedish, English, Danish, German, Finnish and Somali.

- **Fast on old phones.** ~35 KB of JavaScript (gzip) to start, search runs in a background worker.
- **Works offline.** Installable web app; everything works without a connection.
- **Private.** Your diary never leaves your device. No account, no ads, no tracking.
- **Micronutrients first.** ~55 nutrients incl. essential amino acids, compared against NNR 2023 targets.
- **Sync without a server.** Two of your devices sync directly by scanning a QR code.

> Status: the planned roadmap is done — see [docs/ROADMAP.md](docs/ROADMAP.md) and [PROGRESS.md](PROGRESS.md).

## Develop

Requires Node 20+.

```sh
corepack enable
pnpm install
pnpm dev
```

`pnpm test` runs unit tests, `pnpm build` builds and enforces the performance budget,
`pnpm e2e` runs browser smoke tests on an emulated low-end phone
(first time: `pnpm exec playwright install chromium`), and `pnpm lighthouse` audits the build
on a simulated mobile device. CI runs all of these on every pull request; `main` deploys to
GitHub Pages automatically.

## Data sources

- Livsmedelsverket, *Livsmedelsdatabasen* — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- [Open Food Facts](https://world.openfoodfacts.org/) (barcode lookups) — [ODbL](https://opendatacommons.org/licenses/odbl/1-0/)
- [USDA FoodData Central](https://fdc.nal.usda.gov/) SR Legacy + Foundation (international foods) — public domain
- Nordic Nutrition Recommendations 2023 — reference intakes for daily targets

## License

[AGPL-3.0-or-later](LICENSE). Food data keeps its own license (above).
