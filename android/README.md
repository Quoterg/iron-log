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

To finish (first signed build):

1. `cd android && bubblewrap build` — creates the signing key on first run. Keep `android.keystore`
   and its passwords safe and out of git; losing it means the app can never be updated.
2. `bubblewrap fingerprint generateAssetLinks` → commit the resulting `assetlinks.json` to the
   user-site repo as `.well-known/assetlinks.json`. When publishing on Play with Play App Signing,
   add Play's app-signing SHA-256 fingerprint to the same file.
3. Check `https://quoterg.github.io/.well-known/assetlinks.json` returns the JSON, install the APK
   and confirm there's no address bar.

Without the file the app still works, but shows a browser address bar (Custom Tabs fallback).

## Notes

- Package id `io.github.quoterg.ironlog` is final (it can't be changed after the first Play upload).
- Notifications are off (the app has none yet); location/camera: the camera is used through the
  web page's barcode scanner only (the browser asks for permission).
- Store texts, data-safety answers and F-Droid notes: `docs/STORE-LISTING.md`, `docs/FDROID.md`.
