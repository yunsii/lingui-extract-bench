// Parameter presets for the synthetic app generator.
//
// The cost the experimental extractor pays is dominated by:
//   (entries) x (shared component code each entry pulls in)
// because esbuild bundles with splitting:false, so a shared component is
// inlined into — and Babel-reparsed for — every entry that imports it.
//
// Tune these to match your real project's load. Each value can also be
// overridden via env var of the same name (e.g. PAGES=200 ...).
export const PRESETS = {
  // ~5.5s single-thread on a 20-core box; light enough to iterate quickly.
  light: {
    PAGES: 100,
    POOL: 80,
    IMPORTS_PER_PAGE: 15,
    MSGS_PER_COMPONENT: 8,
    MSGS_PER_PAGE: 10,
    FILLER_FNS: 6,
  },
  // ~13-16s single-thread; ~5.8M of source; reproduces real "laggy" load.
  heavy: {
    PAGES: 120,
    POOL: 150,
    IMPORTS_PER_PAGE: 30,
    MSGS_PER_COMPONENT: 10,
    MSGS_PER_PAGE: 12,
    FILLER_FNS: 80,
  },
}

// 20 locales (same set a real multi-locale app would carry).
export const LOCALES = [
  "en", "de", "es", "fr", "it", "pt", "ja", "ko", "ar", "nl",
  "id", "tr", "ru", "tw", "th", "zh", "pl", "da", "nb", "pseudo-LOCALE",
]
