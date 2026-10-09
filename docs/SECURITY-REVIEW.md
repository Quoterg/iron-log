# Security review — 2026-10-09

Reviewed on `main` at 2c5d2d7 (after M19b): service worker, `index.html`, pairing/sync (`pair.ts`,
`sync.ts`), backup validation (`backup.ts`), Open Food Facts read/write (`off.ts`, `off-write.ts`),
scanner, outbound links (`contribute.ts`), CI/deploy workflows, hosting.

**What is already good:** no HTML sinks (no `innerHTML`/`dangerouslySetInnerHTML`/`eval`); all
imported and synced records go through strict validators and must match their key; CSV export
neutralises formulas; sync uses DTLS with the fingerprints carried in the QR codes, no STUN/TURN;
peer clock skew is capped; the zxing WASM is served from this site, not a CDN; the OFF password is
never stored; CI has a read-only token and deploy only runs on green CI for pushes to `main`.

There is no remotely exploitable bug today. The findings are structural weaknesses, ordered by
severity. Fix them in order. Each one needs tests (unit and/or e2e) like any milestone.

---

## S1 (high, needs an owner decision) — the app shares its origin with every `quoterg.github.io` site

The app lives at `https://quoterg.github.io/iron-log/`. Browser storage (IndexedDB, localStorage,
Cache Storage) and permissions (camera) belong to the **origin** (`https://quoterg.github.io`),
not the path. Any page published under that origin can read, change or delete every user's
complete diary, body measurements and profile:

- the user site repo `Quoterg/Quoterg.github.io` (it already serves the root redirect and
  `assetlinks.json`), and **any other repo of this account that enables GitHub Pages later**;
- a compromised workflow, dependency or token in **any** of those repos;
- if the GitHub account is ever renamed or deleted, whoever registers the name `quoterg` gets the
  origin, and with it every installed user's data the next time they open the app.

**Fix:** serve the app from its own origin (a custom domain, e.g. `ironlog.se`, or at least a
subdomain used for nothing else). This changes the origin, so local data **does not move by itself**
and the Android TWA (`android/twa-manifest.json`, `assetlinks.json`) must move too. Needs:

1. Owner decision: buy/choose the domain (write it under "Needs decision" in PROGRESS.md and stop if
   it isn't decided).
2. A migration path: the old origin keeps a small page that offers "Move my data" — exports the
   backup and opens the new origin, which imports it (reuse `parseBackup`; never send the data
   through a URL query string, which ends up in logs — use a downloaded file, or `postMessage` to a
   window opened on the new origin with a strict `event.origin` check on both sides).
3. A new Android build pointing at the new origin; keep the old origin redirecting for a long time.

Until then: never enable GitHub Pages on another repo of this account, and keep the user-site repo
minimal (it currently is).

## S2 (medium) — no Content-Security-Policy

`index.html` sets no CSP, so any injected script (a future HTML sink, a compromised dependency)
can read IndexedDB and send it anywhere, or read the OFF password as it is typed. GitHub Pages
can't set headers, so use a `<meta http-equiv="Content-Security-Policy">` in `index.html` (and in
`public/about.html`, `public/privacy.html`). Starting point — verify every feature with `pnpm e2e`
and adjust only what is proven necessary:

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self';
connect-src 'self' https://world.openfoodfacts.org;
img-src 'self' data: blob:;
style-src 'self';
font-src 'self';
media-src 'self' blob:;
object-src 'none';
base-uri 'none';
form-action 'none';
```

Notes: `wasm-unsafe-eval` is for the zxing fallback; `connect-src` must cover both OFF endpoints
(`/api/v2/product/` and `/cgi/` — same host); `frame-ancestors` is ignored in a meta tag
(clickjacking protection needs real headers, i.e. S1's own domain behind a host/CDN that sets
them). Add an e2e test that fails on any CSP violation (`page.on('console')` /
`securitypolicyviolation` listener) across the existing flows, including scan, OFF upload (mocked),
sync screen and export.

**Status (2026-10-09, M21a):** done — see `src/csp.ts` (tightened to `img-src 'self'` and
`media-src 'self'`, nothing needs more), `e2e/csp.spec.ts` (main flows, scanner fallback with a fake
camera, and the service-worker path) and the static pages' own no-script policy. **Accepted residual
risk:** `frame-ancestors` can't be set in a meta tag, so clickjacking protection needs real response
headers — only possible with an own origin behind a host that sets them (S1/M22, deferred). Existing
installs get the policy on their next online load (the service worker serves pages network-first).

## S3 (low) — the OFF password is typed into this app

M20b asks for the user's Open Food Facts username and password. The code handles it carefully,
but any script running on this origin (S1, S2) could read it. Once S1 and S2 are done the risk is
small, and no code change is needed beyond S1/S2 (autocomplete attributes are right; the password
lives only in component state and is cleared after a successful upload). Keep the "website"
fallback link prominent for users who don't want to type their password here.

## S4 (low) — unbounded input from the paired device

The peer is the user's own device, so this is robustness rather than an attack, but a buggy or
newer app version can still crash an old phone:

- `Reassembler` accepts up to 4096 × 16 KB = 64 MB per message. Lower `MAX_PARTS` to what a
  `BATCH` of 500 records (or a big summary) needs, with a margin, and test the limit.
- The `summary` message isn't size-checked: limit the key count (e.g. ≤ 200 000) and check that
  every value is a finite number before `changesFor` uses it.
- The receive loop has no limit on the number of `changes` batches: stop after
  `ceil(total / BATCH) + 1` batches, and reject a `total` that changes between batches.

## S5 (low) — supply chain hygiene

- Dependencies use major-only ranges (`"preact": "10"`, `"vite": "6"`). CI uses
  `--frozen-lockfile`, which protects CI, but the weekly session runs `pnpm install` and may
  silently update the lockfile. Use `pnpm install --frozen-lockfile` in `CLAUDE.md`/`docs/ROUTINE.md`;
  lockfile changes must be deliberate and mentioned in the PR.
- Pin third-party actions by commit SHA (already done for `pnpm/action-setup`); `actions/*` by tag
  is acceptable.
- Add `.github/dependabot.yml` for `npm` and `github-actions` (weekly, grouped) so security updates
  arrive as PRs. Optional: `pnpm audit --prod` step in CI (non-blocking first).
- Add `SECURITY.md` with a private reporting route (GitHub private vulnerability reporting).

---

## Not issues (checked)

- Service worker only handles same-origin GET; scope is the app path.
- Pairing: an attacker who photographs the first QR code still needs the user to scan the
  attacker's answer; decompressed codes are bounded (≤ 8000 chars in).
- Backup import and sync share the same validators; prototype keys can't reach the stores
  (keys must match the record's key path).
- Outbound links use `rel="noopener noreferrer"` and `encodeURIComponent`.
- The upload-key fingerprint in `assetlinks.yml`/`twa-manifest.json` is public by design.
