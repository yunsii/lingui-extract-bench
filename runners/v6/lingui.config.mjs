// Lingui v6 config. BREAKING vs v5: the `format: 'po'` string shorthand was
// removed — you must pass a formatter instance from @lingui/format-po.
import { formatter } from "@lingui/format-po"

export default {
  locales: [
    "en", "de", "es", "fr", "it", "pt", "ja", "ko", "ar", "nl",
    "id", "tr", "ru", "tw", "th", "zh", "pl", "da", "nb", "pseudo-LOCALE",
  ],
  sourceLocale: "en",
  catalogs: [],
  format: formatter(),
  experimental: {
    extractor: {
      entries: ["<rootDir>/src/pages/**/*.page.tsx"],
      output: "<rootDir>/src/locales/{entryName}/{locale}",
    },
  },
  compileNamespace: "json",
}
