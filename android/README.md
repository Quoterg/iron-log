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
`https://<host>/.well-known/assetlinks.json` **at the root of the origin**. The app currently lives
at `quoterg.github.io/iron-log/`, a GitHub *project* page, which cannot serve files at the origin
root. Options:

1. **Custom domain** (recommended): point e.g. `ironlog.se` at GitHub Pages, set `host` and the
   URLs in `twa-manifest.json` to it, and add `public/.well-known/assetlinks.json`.
2. A `Quoterg.github.io` user-site repo that serves `/.well-known/assetlinks.json`.

Without it the app still works, but shows a browser address bar (Custom Tabs fallback).
Generate the file with `bubblewrap fingerprint generateAssetLinks` (add the Play App Signing
fingerprint too when using Play).

## Notes

- Package id `io.github.quoterg.ironlog` — change it before the first upload if a custom domain
  is used (it can't be changed afterwards on Play).
- Notifications are off (the app has none yet); location/camera: the camera is used through the
  web page's barcode scanner only (the browser asks for permission).
- Store texts, data-safety answers and F-Droid notes: `docs/STORE-LISTING.md`, `docs/FDROID.md`.
