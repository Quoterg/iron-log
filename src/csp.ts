/**
 * Content-Security-Policy of the app (docs/SECURITY-REVIEW.md, S2), added to production builds by
 * vite.config.ts. GitHub Pages can't send headers, so it's a meta tag — frame-ancestors can't be
 * set that way (accepted residual risk, see the review). Widen only for a proven need; csp.test.ts
 * and e2e/csp.spec.ts guard it.
 */
/**
 * Theme boot (M29), written inline in index.html's head after the theme-color metas and before the
 * stylesheet, so the theme (and the browser bar colour for an explicit choice) is set before first
 * paint: the saved choice (Settings → Utseende), else the phone's setting. Allowed by its hash only —
 * change index.html, THEME_BOOT and THEME_BOOT_HASH together (csp.test.ts checks all three match).
 */
export const THEME_BOOT =
  "(function(){var t;try{t=localStorage.getItem('iron-log-theme')}catch(e){}var n=t==='night'||(t!=='day'&&!!window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);var d=document;d.documentElement.setAttribute('data-theme',n?'night':'day');if(t){var m=d.querySelectorAll('meta[name=theme-color]');for(var i=0;i<m.length;i++)m[i].content=n?'#050912':'#eef1f8'}})()";
export const THEME_BOOT_HASH = 'sha256-ZzWIPloZstWYQUZEE8v25Jxi35qSfD4R0pv8JbS4eQk=';

export const CSP_DIRECTIVES: [directive: string, sources: string][] = [
  ['default-src', "'self'"],
  // wasm-unsafe-eval: the zxing barcode-scanner fallback (browsers without BarcodeDetector).
  // The hash: the theme boot script above, nothing else inline.
  ['script-src', `'self' 'wasm-unsafe-eval' '${THEME_BOOT_HASH}'`],
  ['worker-src', "'self'"], // search worker, service worker
  // This site and Open Food Facts (lookups, uploads). Sync (WebRTC) isn't governed by CSP.
  ['connect-src', "'self' https://world.openfoodfacts.org"],
  ['img-src', "'self'"],
  // Only stylesheets from this site. Preact sets style={…} via the CSSOM (element.style), which
  // style-src doesn't restrict — never build style="…" attribute strings by hand.
  ['style-src', "'self'"],
  ['font-src', "'self'"],
  ['media-src', "'self'"], // the camera preview uses srcObject, not a URL
  ['object-src', "'none'"],
  ['base-uri', "'none'"],
  ['form-action', "'none'"],
];

export const CSP = CSP_DIRECTIVES.map(([d, s]) => `${d} ${s}`).join('; ');
