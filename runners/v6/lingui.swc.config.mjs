// Lingui v6 config that swaps the Babel extractor for the native Rust (SWC)
// extractor (lingui-swc). In the experimental flow this replaces the Babel
// parse-of-the-bundle step with SWC; esbuild bundling and catalog writing are
// unchanged. Run with: lingui extract-experimental --config lingui.swc.config.mjs
import { formatter } from "@lingui/format-po"
import { createSwcExtractor } from "lingui-swc"

export default {
  locales: [
    "en", "de", "es", "fr", "it", "pt", "ja", "ko", "ar", "nl",
    "id", "tr", "ru", "tw", "th", "zh", "pl", "da", "nb", "pseudo-LOCALE",
  ],
  sourceLocale: "en",
  catalogs: [],
  format: formatter(),
  extractors: [createSwcExtractor()],
  experimental: {
    extractor: {
      entries: ["<rootDir>/src/pages/**/*.page.tsx"],
      output: "<rootDir>/src/locales/{entryName}/{locale}",
    },
  },
  compileNamespace: "json",
}
