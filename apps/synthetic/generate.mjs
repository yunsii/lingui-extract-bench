#!/usr/bin/env node
// Deterministic generator for the synthetic extraction-target app.
//
// Writes src/components/Shared*.tsx, src/pages/*.page.tsx and tsconfig.json
// into --out <dir>. No randomness: same params => byte-identical output, so a
// v5 runner and a v6 runner extract the exact same source (fair A/B).
//
// Usage:
//   node generate.mjs --out <dir> [--preset light|heavy] [KEY=VAL ...]
//   PAGES=200 node generate.mjs --out ../../runners/v6 --preset heavy
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PRESETS, LOCALES } from "./presets.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const args = { out: null, preset: "heavy" }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i]
    else if (argv[i] === "--preset") args.preset = argv[++i]
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
if (!args.out) {
  console.error("error: --out <dir> is required")
  process.exit(1)
}
const base = PRESETS[args.preset]
if (!base) {
  console.error(`error: unknown preset "${args.preset}" (have: ${Object.keys(PRESETS).join(", ")})`)
  process.exit(1)
}
// env overrides win over preset
const cfg = Object.fromEntries(
  Object.entries(base).map(([k, v]) => [k, process.env[k] != null ? Number(process.env[k]) : v]),
)

const ROOT = path.resolve(process.cwd(), args.out)

function write(rel, content) {
  const f = path.join(ROOT, rel)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, content)
}

// extra code so each file has realistic Babel/SWC parse weight (pure, harmless)
function filler(prefix) {
  let s = ""
  for (let k = 0; k < cfg.FILLER_FNS; k++) {
    s += `
function ${prefix}_calc${k}(a: number, b: number) {
  const arr = [a, b, a + b, a * b, ${k}]
  return arr.reduce((acc, x) => acc + (x % 7) * ${k + 1}, 0)
}
const ${prefix}_data${k} = { id: ${k}, label: "item-${k}", nested: { a: ${k}, b: ${k * 2}, c: [1, 2, 3, ${k}] } }
`
  }
  return s
}

function componentFile(i) {
  let msgs = ""
  for (let m = 0; m < cfg.MSGS_PER_COMPONENT; m++) {
    msgs += `      <p><Trans>Shared component ${i} message ${m}: hello {name}</Trans></p>\n`
  }
  return `import { Trans, useLingui } from '@lingui/react/macro'

type Props = { name: string }
${filler(`C${i}`)}
export function Shared${i}({ name }: Props) {
  const { t } = useLingui()
  const title = t\`Shared ${i} title for \${name}\`
  return (
    <section data-c="${i}">
      <h2>{title}</h2>
${msgs}    </section>
  )
}
`
}

function pageFile(i) {
  // deterministic, overlapping subset of shared components
  const imports = []
  for (let j = 0; j < cfg.IMPORTS_PER_PAGE; j++) {
    imports.push((i * 7 + j * 13) % cfg.POOL)
  }
  const uniq = [...new Set(imports)]
  const importLines = uniq.map((c) => `import { Shared${c} } from '../components/Shared${c}'`).join("\n")
  const usage = uniq.map((c) => `        <Shared${c} name={"page${i}"} />`).join("\n")
  let msgs = ""
  for (let m = 0; m < cfg.MSGS_PER_PAGE; m++) {
    msgs += `        <li><Trans>Page ${i} item ${m}: welcome {user}</Trans></li>\n`
  }
  return `import { Trans, useLingui } from '@lingui/react/macro'
${importLines}
${filler(`P${i}`)}
export default function Page${i}() {
  const { t } = useLingui()
  const heading = t\`Page ${i} heading\`
  const user = "u${i}"
  return (
    <main>
      <h1>{heading}</h1>
      <ul>
${msgs}      </ul>
${usage}
    </main>
  )
}
`
}

fs.rmSync(path.join(ROOT, "src"), { recursive: true, force: true })

for (let i = 0; i < cfg.POOL; i++) write(`src/components/Shared${i}.tsx`, componentFile(i))
for (let i = 0; i < cfg.PAGES; i++) write(`src/pages/page${i}.page.tsx`, pageFile(i))

write("tsconfig.json", JSON.stringify({
  compilerOptions: {
    jsx: "preserve", module: "esnext", target: "esnext",
    moduleResolution: "bundler", strict: false, skipLibCheck: true,
  },
  include: ["src"],
}, null, 2) + "\n")

const approxMessages = cfg.POOL * (cfg.MSGS_PER_COMPONENT + 1) + cfg.PAGES * (cfg.MSGS_PER_PAGE + 1)
console.log(JSON.stringify({
  out: ROOT, preset: args.preset, ...cfg,
  locales: LOCALES.length, components: cfg.POOL, pages: cfg.PAGES, approxUniqueMessages: approxMessages,
}, null, 2))
