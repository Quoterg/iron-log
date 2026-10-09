/**
 * Content-Security-Policy of the app (docs/SECURITY-REVIEW.md, S2), added to production builds by
 * vite.config.ts. GitHub Pages can't send headers, so it's a meta tag — frame-ancestors can't be
 * set that way (accepted residual risk, see the review). Widen only for a proven need; csp.test.ts
 * and e2e/csp.spec.ts guard it.
 */
export const CSP_DIRECTIVES: [directive: string, sources: string][] = [
  ['default-src', "'self'"],
  // wasm-unsafe-eval: the zxing barcode-scanner fallback (browsers without BarcodeDetector).
  ['script-src', "'self' 'wasm-unsafe-eval'"],
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
