#!/usr/bin/env node
// CI guard: flag source files that mix a TS ambient declaration block
// (declare module / declare global / declare namespace) with Lingui macros.
// Such files lose every message AFTER the declare block when extracted with
// lingui-swc. Move the declare block to a *.d.ts file (or the file's end).
//
// Usage: node scripts/check-declare-lingui.mjs <dir> [<dir> ...]   (default: cwd)
import fs from "node:fs"
import path from "node:path"

const roots = process.argv.slice(2)
if (roots.length === 0) roots.push(process.cwd())

const DECLARE = /^\s*declare\s+(module|global|namespace)\b/m
const MACRO = /from\s+['"]@lingui\/(react|core)\/macro['"]/

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      out.push(p)
    }
  }
}

const files = []
for (const r of roots) walk(r, files)

const bad = files.filter((f) => {
  const c = fs.readFileSync(f, "utf8")
  return DECLARE.test(c) && MACRO.test(c)
})

if (bad.length) {
  console.error("✖ Files mixing a `declare` block with Lingui macros (lingui-swc will drop messages after it):")
  for (const f of bad) console.error("  - " + f)
  console.error("\nMove the ambient declaration into a sibling *.d.ts file (idiomatic, and avoids the bug).")
  process.exit(1)
}
console.log(`✓ No file mixes ambient declarations with Lingui macros (${files.length} scanned).`)
