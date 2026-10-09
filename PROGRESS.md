# Progress log

Newest first. Each weekly session adds one entry: what was done, what's next, open issues.
Keep entries short — this file is read at the start of every session.

## Next up

**M3 Food detail & custom foods** (see docs/ROADMAP.md).

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
