// Phase profiler for the Lingui v5 experimental extractor (single-threaded).
// Same three-phase split as tools/profile.mjs, adapted for the v5 dist:
//   - v5 ships CommonJS modules (require, not import)
//   - bundleSource signature is (config, entryPoints, outDir, rootDir) — no extractorConfig arg
//   - entry points come from getEntryPoints(); bundle outputs live at result.metafile.outputs
//
// Run from inside the v5 runner:  cd runners/v5 && node ../../tools/profile-v5.mjs
import { performance } from "node:perf_hooks"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

// Resolve all lingui modules from the CWD (the runner dir), not this script's dir.
const require = createRequire(pathToFileURL(path.join(process.cwd(), "index.js")))
const DIST = path.join(process.cwd(), "node_modules/@lingui/cli/dist")
const { getConfig } = require(require.resolve("@lingui/conf"))
const { bundleSource } = require(path.join(DIST, "extract-experimental/bundleSource.js"))
const { getEntryPoints } = require(path.join(DIST, "extract-experimental/getEntryPoints.js"))
const { writeCatalogs } = require(path.join(DIST, "extract-experimental/writeCatalogs.js"))
const { getFormat } = require(path.join(DIST, "api/formats/index.js"))
const extract = require(path.join(DIST, "api/extractors/index.js")).default
const { mergeExtractedMessage } = require(path.join(DIST, "api/catalog/extractFromFiles.js"))

const config = getConfig({})
const ex = config.experimental.extractor
const rootDir = config.rootDir
const entries = getEntryPoints(ex.entries)

await fs.rm("src/locales", { recursive: true, force: true })
await fs.mkdir(".lingui", { recursive: true })
const tempDir = await fs.mkdtemp(".lingui/p")
await fs.rm(tempDir, { recursive: true, force: true })

let t = performance.now()
const meta = await bundleSource(config, entries, tempDir, rootDir)
const tBundle = performance.now() - t

const format = await getFormat(config.format, config.sourceLocale)
const mf = meta.metafile || meta
const outFiles = Object.keys(mf.outputs)

let tExtract = 0, tWrite = 0, totalMsgs = 0
for (const outFile of outFiles) {
  const { entryPoint } = mf.outputs[outFile]
  const messages = {}
  t = performance.now()
  await extract(outFile, (m) => mergeExtractedMessage(m, messages, config), config)
  tExtract += performance.now() - t
  totalMsgs += Object.keys(messages).length
  t = performance.now()
  await writeCatalogs({
    locales: config.locales, linguiConfig: config, clean: false, format, messages,
    entryPoint, overwrite: false, outputPattern: ex.output,
  })
  tWrite += performance.now() - t
}
await fs.rm(tempDir, { recursive: true, force: true })

const total = tBundle + tExtract + tWrite
const pct = (x) => `${((x / total) * 100).toFixed(1)}%`
console.log(JSON.stringify({
  version: require(path.join(process.cwd(), "node_modules/@lingui/cli/package.json")).version,
  entries: outFiles.length, locales: config.locales.length, totalMsgsAcrossEntries: totalMsgs,
  bundle_s: +(tBundle / 1000).toFixed(2), extract_s: +(tExtract / 1000).toFixed(2), write_s: +(tWrite / 1000).toFixed(2),
  total_s: +(total / 1000).toFixed(2),
  breakdown: { bundle: pct(tBundle), extract_babel: pct(tExtract), merge_write: pct(tWrite) },
}, null, 2))
