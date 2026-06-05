// Lingui v5 config. Note v5 still accepts the `format: 'po'` string shorthand.
export default {
  locales: [
    "en", "de", "es", "fr", "it", "pt", "ja", "ko", "ar", "nl",
    "id", "tr", "ru", "tw", "th", "zh", "pl", "da", "nb", "pseudo-LOCALE",
  ],
  sourceLocale: "en",
  catalogs: [],
  format: "po",
  experimental: {
    extractor: {
      entries: ["<rootDir>/src/pages/**/*.page.tsx"],
      output: "<rootDir>/src/locales/{entryName}/{locale}",
    },
  },
  compileNamespace: "json",
}
