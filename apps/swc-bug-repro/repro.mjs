// Runs lingui-swc on the fixtures and asserts the bug. Exit 1 if the bug is
// present (so it doubles as a regression test once a fix lands).
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { extractMessages } from "lingui-swc"

const here = path.dirname(fileURLToPath(import.meta.url))
const opts = { parser: { tsx: true, syntax: "typescript" } }

const fixtures = [
  { file: "src/declare-module.tsx", expected: ["Click to erase", "Feature tag"] }, // BUG: gets []
  { file: "src/declare-global.tsx", expected: ["Your Credits", "Choose Pack", "Purchase"] }, // BUG: drops post-declare
  { file: "src/control.tsx", expected: ["Your Credits", "Choose Pack", "Purchase"] }, // OK (no declare)
  { file: "src/workaround.tsx", expected: ["Your Credits", "Choose Pack", "Purchase"] }, // OK (declare moved to end)
]

let bug = false
for (const fx of fixtures) {
  const code = await fs.readFile(path.join(here, fx.file), "utf8")
  const got = (await extractMessages(code, fx.file, opts)).messages.map((m) => m.message).sort()
  const exp = [...fx.expected].sort()
  const ok = got.length === exp.length && got.every((m, i) => m === exp[i])
  const missing = exp.filter((m) => !got.includes(m))
  console.log(`${ok ? "✅" : "❌"} ${fx.file}`)
  console.log(`   expected: ${JSON.stringify(exp)}`)
  console.log(`   got     : ${JSON.stringify(got)}`)
  if (!ok) { console.log(`   MISSING : ${JSON.stringify(missing)}`); bug = true }
}

console.log(
  bug
    ? "\n⛔ BUG PRESENT: lingui-swc drops messages after `declare module/global/namespace`."
    : "\n✅ All fixtures extracted correctly (bug fixed).",
)
process.exit(bug ? 1 : 0)
