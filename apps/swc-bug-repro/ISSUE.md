# Bug report — posted to `lingui/js-lingui#2436` ("Rust extractor")

> ✅ POSTED: https://github.com/lingui/js-lingui/issues/2436#issuecomment-4628810317
>
> The bug lives in **`lingui-swc`** (repo `timofei-iatsenko/lingui-rust-tools`,
> which has issues disabled). The maintainer solicits lingui-swc feedback in
> js-lingui#2436, so it was posted there.
> Repro repo: https://github.com/yunsii/lingui-extract-bench (`apps/swc-bug-repro`)

---

Tried `lingui-swc` as a drop-in extractor and hit a bug:
**it drops every message that appears after a `TsModuleDecl` block** (`module` /
`namespace` / `declare module` / `declare global`).

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

Neither the macro fold (`js_macro_folder` only overrides `fold_expr`/`fold_call_expr`
+ `fold_children_with`) nor `MessageExtractorVisitor` manually skips module items —
so this is **not** a traversal halt. The trigger being a `TsModuleDecl` specifically
(while `declare const`/`declare function` are fine) points to a **binding/scope
resolution gap**: after a `TsModuleDecl`, references to the `Trans`/`t` import are no
longer recognized as the macro binding, so the extractor's `is_trans_component` /
macro-call checks return false and skip them. Likely an interaction between the SWC
`resolver` pass and `TsModuleDecl`, or how the import binding is captured.

Note: reproduced via the **`lingui-swc` extractor** path (`resolver → fold →
MessageExtractorVisitor`). The runtime transform path (`resolver → fold`, no
extractor visitor) was not observed to be affected, but since both share the
`resolver` step, please confirm the transform recognizes post-`TsModuleDecl`
macros.

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
