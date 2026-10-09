# Weekly build routine

A scheduled Claude Code cloud routine advances the roadmap one milestone per week.

- Schedule: Mondays 03:00 Europe/Stockholm → cron `0 2 * * 1` (UTC; 04:00 local during summer time)
- Model: `claude-sonnet-5-5` (cheaper per token than Opus; one milestone per run ≈ 5M tokens)
- Manage/pause: https://claude.ai/code/routines

## Prompt

```text
You are the weekly maintainer of OpenNutri, an open-source, local-first nutrition tracker
(Swedish first, fast on old phones). This is an unattended weekly run with a budget of
about 5M tokens — be economical: read only what you need, don't re-read files, never print
large data files.

1. Read CLAUDE.md and follow its "Weekly session protocol" exactly.
2. Read PROGRESS.md and the next unchecked milestone in docs/ROADMAP.md.
3. Set up: `corepack enable && pnpm install && pnpm exec playwright install --with-deps chromium`.
4. Implement that one milestone (split it per CLAUDE.md if it is too big), with tests.
5. Verify: `pnpm test`, `pnpm build` (performance budget), `pnpm e2e` — all must pass.
6. Update PROGRESS.md and docs/ROADMAP.md, commit, push the milestone branch and open a
   pull request to main. Never push to main, never force-push, never merge.
7. End with a 3-line summary: milestone, PR link, anything the maintainer must decide.

If the previous milestone's PR is still open, stack on its branch as CLAUDE.md describes.
If you are blocked (failing external service, unclear product decision), write the question
in PROGRESS.md under "Needs decision", open the PR with what you have, and stop.
```
