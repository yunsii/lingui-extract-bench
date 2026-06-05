# Issue draft — target: `lingui/swc-plugin`

> Prepared, not yet submitted. Review before filing.
> Repro repo: https://github.com/yunsii/lingui-extract-bench (`apps/swc-bug-repro`)

---

**Title:** Macro skips all messages after a `TsModuleDecl` block (`module` / `namespace` / `declare module` / `declare global`)

## Summary

When a file contains a TypeScript module/namespace block (`declare module "..."`,
`declare global`, `declare namespace`, or a plain `namespace`/`module`), the Lingui
macro **stops processing every message that appears after that block, in source
order**.

- Block at the top of the file → **no messages** are processed in the whole file.
- Block between two components → messages **before** it are fine, everything
  **after** it is silently dropped.

No error is thrown. Observed via the `lingui-swc` extractor (v0.6.0, which reuses
this macro), so generated catalogs silently miss strings; if the runtime transform
shares the same visitor it would skip the same `Trans`/`t` calls too — please
confirm.

## Reproduction

Minimal — a single `declare module` before a single `<Trans>`:

```tsx
import { Trans } from "@lingui/react/macro"
declare module "x" {
  interface I { a: string }
}
export const A = () => <Trans>hello</Trans>
```

Expected: `["hello"]` extracted/transformed.
Actual: **nothing** (`[]`).

Runnable: https://github.com/yunsii/lingui-extract-bench → `pnpm --filter @bench/app-swc-bug-repro repro`

## What triggers it (and what doesn't)

| construct before the message | processed? |
|------------------------------|:---------:|
| `declare module "x" { ... }` | ❌ |
| `declare global { ... }`     | ❌ |
| `declare namespace N { ... }`| ❌ |
| `namespace N { ... }` (no `declare`) | ❌ |
| `declare const x: number`    | ✅ |
| `declare function f(): void` | ✅ |
| `interface I<T> { ... }`     | ✅ |

So the trigger is specifically a **`TsModuleDecl`** node, not ambient declarations
in general.

## Root-cause hypothesis

The visitor/folder appears to stop walking sibling module items once it encounters
a `TsModuleDecl` (module/namespace). Everything after that node in the same scope
is never visited, so its macros are neither transformed nor collected. (Likely in
the shared `lingui_macro` crate — `js_macro_folder` / item iteration.)

## Impact

Real-world: found on a production app while A/B-testing `lingui-swc` vs Babel.
Babel extracts all messages; `lingui-swc` dropped 3 across 2 files — both files had
a `declare module` / `declare global` block (a TipTap command augmentation and a
`Window` augmentation). The result is silently-untranslated UI strings.

Babel's extractor does **not** have this problem, so it's a parity gap between the
Babel and SWC paths.

## Environment

- `lingui-swc` 0.6.0 (reuses `@lingui/swc-plugin` 6.3.0 macro)
- parser options: `{ tsx: true, syntax: "typescript" }`
- Node 22, Linux

## Workaround (for others hitting this)

Move ambient declarations into a separate `*.d.ts` file (idiomatic anyway), so no
message-bearing code follows a `TsModuleDecl` in the same file.
