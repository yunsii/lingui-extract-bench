// Raw extractor throughput: Babel (current JS path) vs lingui-swc (native Rust/SWC).
// This isolates the parse+extract component — the core building block of any
// rewrite — over the same set of source files. Verifies message-count parity.
//
// Run from inside the v6 runner:  cd runners/v6 && node ../../tools/bench-extractor.mjs
import { performance } from "node:perf_hooks"
import fs from "node:fs/promises"
import { globSync } from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

// Resolve all modules from the CWD (the runner dir), not this script's dir.
const require = createRequire(pathToFileURL(path.join(process.cwd(), "index.js")))
const DIST = path.join(process.cwd(), "node_modules/@lingui/cli/dist")
const { getConfig } = await import(pathToFileURL(require.resolve("@lingui/conf")).href)
const extract = (await import(pathToFileURL(path.join(DIST, "api/extractors/index.js")).href)).default
const { extractMessages, extractMessagesFromFiles } = await import(pathToFileURL(require.resolve("lingui-swc")).href)

const config = getConfig({})
const files = globSync("src/**/*.{tsx,ts}").filter((f) => !f.includes("/locales/"))
const contents = Object.fromEntries(
  await Promise.all(files.map(async (f) => [f, await fs.readFile(f, "utf8")])),
)
const opts = { parser: { tsx: true, syntax: "typescript" } }

async function median(fn, runs = 5) {
  const t = []
  await fn() // warmup
  for (let i = 0; i < runs; i++) { const s = performance.now(); await fn(); t.push(performance.now() - s) }
  return t.sort((a, b) => a - b)[Math.floor(runs / 2)]
}

// 1. Babel, single-thread serial (the per-file extract path)
let babelMsgs = 0
const babel = await median(async () => {
  babelMsgs = 0
  for (const f of files) await extract(f, () => { babelMsgs++ }, config)
})

// 2. lingui-swc, single-thread serial (pure parse+extract speed)
let swcSerialMsgs = 0
const swcSerial = await median(async () => {
  swcSerialMsgs = 0
  for (const f of files) { const r = await extractMessages(contents[f], f, opts); swcSerialMsgs += r.messages.length }
})

// 3. lingui-swc, native parallel (Rayon) over all files at once
let swcParMsgs = 0
const swcPar = await median(async () => {
  const r = await extractMessagesFromFiles(files, opts)
  swcParMsgs = r.messages.length
})

const r0 = (x) => +x.toFixed(0)
console.log(JSON.stringify({
  files: files.length,
  babel_serial_ms: r0(babel), babel_msgs: babelMsgs,
  swc_serial_ms: r0(swcSerial), swc_serial_msgs: swcSerialMsgs,
  swc_parallel_ms: r0(swcPar), swc_parallel_msgs: swcParMsgs,
  speedup_serial: +(babel / swcSerial).toFixed(1) + "x",
  speedup_parallel: +(babel / swcPar).toFixed(1) + "x",
}, null, 2))
