# Iron Log — notes for AI coding sessions

Open-source, local-first nutrition tracker (energy, macros, micronutrients).
Swedish first (Livsmedelsverket data, NNR 2023 targets, `sv` UI), useful everywhere (`en`).
Must stay fast on old low/mid-range phones. Read docs/ARCHITECTURE.md before structural changes.

## Weekly session protocol (scheduled runs)

1. Read `PROGRESS.md` (top) and the next unchecked milestone in `docs/ROADMAP.md`. Nothing else up front.
2. Branch: `git fetch origin`. If the previous milestone's PR is still open (unmerged), base the new
   branch on that PR's branch; otherwise on `origin/main`. Name: `milestone/mN-short-name`.
3. Do **one milestone** only. Token budget is ~5M per run: if the milestone is clearly larger,
   split it in ROADMAP.md (`M7a`/`M7b`) and do the first part. Stop when it's done — don't start the next one.
4. Before finishing, all must pass: `pnpm test`, `pnpm build` (includes size budget), `pnpm e2e`,
   `pnpm lighthouse`. CI (.github/workflows/ci.yml) runs the same on the PR — check it with
   `gh pr checks` and fix failures before ending the session.
   If something can't be made to pass, say so in PROGRESS.md and the PR — never hide failures.
5. Update `PROGRESS.md` (new entry at top + "Next up"), tick the milestone in ROADMAP.md.
6. Commit, push the branch, open a PR to `main` titled `Mn: <name>` with a short summary and test results.
   Never push to `main`, never force-push, never merge.

## Commands

```sh
corepack enable            # once; pnpm version is pinned in package.json
pnpm install
pnpm dev                   # local dev server
pnpm test                  # Vitest unit tests (src/**/*.test.ts)
pnpm build                 # typecheck + build + performance budget (scripts/check-size.mjs)
pnpm e2e                   # Playwright smoke tests on emulated Moto G4, 4× CPU throttle (needs a build)
pnpm lighthouse            # Lighthouse CI on dist/ (mobile, simulated slow 4G); gates in lighthouserc.json
                           # locally: CHROME_PATH=~/.cache/ms-playwright/chromium-*/chrome-linux/chrome
pnpm data:fetch            # re-download Livsmedelsverket data → data/raw (slow, ~2.6k requests)
pnpm data:build            # data/raw → public/data/foods.json
```

## Rules

- **Performance budget is a hard gate**: initial JS ≤ 40 KB gzip, CSS ≤ 8 KB, food data ≤ 250 KB per file.
  No UI/component libraries, chart libraries, icon fonts, CSS-in-JS, moment/lodash. Ask "does this
  need to load before first paint?" — if not, lazy-load it.
- Heavy work (parsing food data, search) runs in `src/worker/`, never on the UI thread.
- User data stays on device (IndexedDB, `src/lib/db.ts`). No analytics, no third-party requests
  except explicit user actions (e.g. barcode lookup on Open Food Facts).
- Nutrient vectors follow `src/lib/nutrients.json` order; every food source maps into it.
  Adding a nutrient = add to nutrients.json + rebuild data + targets if any.
- All UI strings go through `t()` in `src/lib/i18n.ts`, both `sv` and `en`. Numbers via `fmt()`.
- Data licenses: Livsmedelsverket CC BY 4.0, Open Food Facts ODbL, USDA public domain —
  keep attribution visible in Settings.
- Never `cat`/read `public/data/foods.json` or `data/raw/*` whole — they're large. Use `python3 -c`/`node -e` to query them.
- Match existing code style: small modules, plain functions, Preact signals for shared state.
