# Android app (Trusted Web Activity)

The Android app is the same PWA, opened full-screen in a Trusted Web Activity (TWA): no second
code base, updates arrive with the website, and the app stays as small and fast as the web app.
`twa-manifest.json` is the [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) config.

## Build

```sh
npm i -g @bubblewrap/cli          # needs JDK 17 and the Android SDK (Bubblewrap can install both)
cd android
bubblewrap build                  # first run creates android.keystore — keep it safe, NOT in git
```

`bubblewrap build` produces `app-release-bundle.aab` (Play Store) and `app-release-signed.apk`
(sideloading, other stores). Bump `appVersionCode` / `appVersionName` for each release.

## Digital Asset Links (required before publishing)

A TWA hides the browser UI only if the site proves it owns the app, with
`https://<host>/.well-known/assetlinks.json` **at the root of the origin**. The app lives at
`quoterg.github.io/iron-log/`, a GitHub *project* page, which cannot serve the origin root.

**Decision (2026-10-09): the free GitHub user site** [Quoterg/Quoterg.github.io](https://github.com/Quoterg/Quoterg.github.io)
serves the root (it already has `.nojekyll`, so `.well-known/` is published, and forwards `/` to
the app). Why not a custom domain or another host: it would cost money, and moving the app to a
new origin would leave every user's data behind (browser storage is per origin). The app, its
URL and the package id `io.github.quoterg.ironlog` stay as they are.

**Shared-origin rule (important):** every GitHub Pages site of the account is the same origin,
`https://quoterg.github.io`, and browser storage (IndexedDB, localStorage, service workers) is per
origin, not per path. Any script on any page there could read or wipe users' food logs. So:

- The user-site repo holds only static files: `.nojekyll`, `index.html` (a plain
  `<meta http-equiv="refresh">` link — no script, no service worker), `README.md` and
  `.well-known/assetlinks.json`. Never add JavaScript, third-party embeds or user content to it.
- Don't enable GitHub Pages on any other repo of this account (checked 2026-10-09: only
  `iron-log` and `Quoterg.github.io` publish Pages). A future project needing Pages goes on another
  account or a custom domain.
- The app's service worker scope stays `/iron-log/` — never widen it to `/`, or it would intercept
  the user site and `/.well-known/assetlinks.json`. Likewise `startUrl` stays `/iron-log/`.

To finish (first signed build):

1. `cd android && bubblewrap build` — creates the upload key on first run. `android/*.keystore`
   is git-ignored. Back up the keystore and its passwords outside the repo (e.g. a password
   manager's file attachment plus an offline copy). Enrol in **Play App Signing** when creating
   the Play listing: Google then holds the app-signing key and a lost upload key can be reset;
   without it, losing the keystore means the app can never be updated.
2. `bubblewrap fingerprint generateAssetLinks` → commit the resulting `assetlinks.json` to the
   user-site repo as `.well-known/assetlinks.json`. When publishing on Play with Play App Signing,
   add Play's app-signing SHA-256 fingerprint to the same file.
3. Check `https://quoterg.github.io/.well-known/assetlinks.json` returns the JSON, install the APK
   and confirm there's no address bar.

Without the file the app still works, but shows a browser address bar (Custom Tabs fallback).

**Live since 2026-10-09:** https://quoterg.github.io/.well-known/assetlinks.json — package
`io.github.quoterg.ironlog`, upload-key SHA-256
`F9:FF:C7:18:F1:E9:E9:F7:C2:F0:94:53:ED:8E:FB:D5:7C:39:F3:DF:C5:6A:1E:D2:E8:0C:0B:E0:19:23:DC:4F`
(also in `twa-manifest.json` → `fingerprints`). `.github/workflows/assetlinks.yml` checks weekly
that it's still served. With Play App Signing, Play re-signs the app with its own key: add that
key's fingerprint to the same file, or the Play build shows the browser bar.

## Notes

- Package id `io.github.quoterg.ironlog` is final (it can't be changed after the first Play upload).
- minSdkVersion 24 (Android 7.0): required by androidbrowserhelper 2.7+. Older phones use the
  web app in the browser instead.
- Notifications are off (the app has none yet); location/camera: the camera is used through the
  web page's barcode scanner only (the browser asks for permission).
- Store texts, data-safety answers and F-Droid notes: `docs/STORE-LISTING.md`, `docs/FDROID.md`.
