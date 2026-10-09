# Iron Log

Open-source nutrition tracker for energy, macros **and micronutrients** — a free alternative
to Cronometer and MyFitnessPal. Swedish first (Livsmedelsverket's food database and the Nordic
Nutrition Recommendations 2023), with English UI for everyone else.

- **Fast on old phones.** ~15 KB of JavaScript to start, search runs in a background worker.
- **Works offline.** Installable web app; everything works without a connection.
- **Private.** Your diary never leaves your device. No account, no ads, no tracking.
- **Micronutrients first.** ~40 nutrients per food, compared against NNR 2023 targets.

> Status: early development — see [docs/ROADMAP.md](docs/ROADMAP.md) and [PROGRESS.md](PROGRESS.md).

## Develop

Requires Node 20+.

```sh
corepack enable
pnpm install
pnpm dev
```

`pnpm test` runs unit tests, `pnpm build` builds and enforces the performance budget,
`pnpm e2e` runs browser smoke tests on an emulated low-end phone
(first time: `pnpm exec playwright install chromium`).

## Data sources

- Livsmedelsverket, *Livsmedelsdatabasen* — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Nordic Nutrition Recommendations 2023 — reference intakes for daily targets

## License

[AGPL-3.0-or-later](LICENSE). Food data keeps its own license (above).
