# `@bench/app-swc-bug-repro`

Minimal reproduction of a **lingui-swc extraction bug** found while A/B-testing the
native Rust extractor against Babel on a real project.

## The bug

`lingui-swc` (the native Rust/SWC extractor, ≤ 0.6.0) **silently skips every
message that appears, in source order, AFTER a TypeScript ambient declaration
block** — `declare module "..."`, `declare global`, or `declare namespace`.

- If the `declare` block is at the top of the file → **0 messages extracted**.
- If it sits between components → messages **before** it are extracted, everything
  **after** it is dropped.

Babel (the default extractor) extracts all of them, so this only bites if you swap
in `createSwcExtractor()`.

## Fixtures

| file | trigger | lingui-swc result |
|------|---------|-------------------|
| `src/declare-module.tsx` | `declare module` at top | ❌ `[]` (both missed) |
| `src/declare-global.tsx` | `declare global` between components | ❌ drops post-declare messages |
| `src/control.tsx` | none | ✅ all extracted |
| `src/workaround.tsx` | `declare global` moved to file end | ✅ all extracted |

## Run

```bash
pnpm --filter @bench/app-swc-bug-repro repro
```

Exits non-zero while the bug is present, so it doubles as a regression test once a
fix lands.

## Root cause (hypothesis)

The macro visitor (shared `lingui_macro` crate used by both `@lingui/swc-plugin`
and `lingui-swc`) stops walking top-level items after it encounters a
`TsModuleDecl` (ambient module/namespace). Reported upstream; see the repo issue.

## Workaround (no fork needed)

Ambient declarations belong in `*.d.ts` files anyway. Move `declare module` /
`declare global` / `declare namespace` blocks out of files that contain Lingui
macros (into a sibling `.d.ts`, or to the very end of the file). The repo guard
`scripts/check-declare-lingui.mjs` flags any file that mixes both.
