// Phase profiler for the Lingui v6 experimental extractor (single-threaded).
// Splits one extraction run into its three phases so you can see where time goes:
//   1. esbuild bundle (incl. per-source Babel macro transform) — NOT parallelized
//   2. Babel parse of each bundle + collect messages           — parallel in workers
//   3. mergeCatalog + write .po (x locales)                    — parallel in workers
//
// Run from inside a runner dir:  cd runners/v6 && node ../../tools/profile.mjs
import { performance } from "node:perf_hooks"
import fs from "node:fs/promises"
import { globSync } from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

// Resolve all lingui modules from the CWD (the runner dir), not from this
// script's location — the tool lives outside the runner's node_modules.
const require = createRequire(pathToFileURL(path.join(process.cwd(), "index.js")))
const DIST = path.join(process.cwd(), "node_modules/@lingui/cli/dist")
const imp = (p) => import(pathToFileURL(path.join(DIST, p)).href)
const { getConfig } = await import(pathToFileURL(require.resolve("@lingui/conf")).href)
const { bundleSource } = await imp("extract-experimental/bundleSource.js")
const { writeCatalogs } = await imp("extract-experimental/writeCatalogs.js")
const { getFormat } = await imp("api/formats/index.js")
const extract = (await imp("api/extractors/index.js")).default
const { mergeExtractedMessage } = await imp("api/catalog/extractFromFiles.js")

const config = getConfig({})
const ex = config.experimental.extractor
const entries = globSync(ex.entries)
const rootDir = config.rootDir

await fs.rm("src/locales", { recursive: true, force: true })
await fs.mkdir(".lingui", { recursive: true })
const tempDir = await fs.mkdtemp(".lingui/p")
await fs.rm(tempDir, { recursive: true, force: true })

let t = performance.now()
const meta = await bundleSource(config, ex, entries, tempDir, rootDir)
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
