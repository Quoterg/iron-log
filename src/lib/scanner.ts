// Camera barcode detection. Uses the browser's BarcodeDetector where it exists (Chrome on
// Android); otherwise loads a WASM fallback (zxing) — only when the scanner is opened, and
// served from this site (no third-party CDN).

export interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface NativeDetectorCtor {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

/** Product barcodes by default; the sync screen asks for ['qr_code']. */
export async function createDetector(formats: string[] = FORMATS): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats();
      const usable = formats.filter((f) => supported.includes(f));
      if (usable.length) return new Native({ formats: usable });
    } catch {
      // fall through to WASM
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  });
  return new BarcodeDetector({ formats: formats as never });
}
