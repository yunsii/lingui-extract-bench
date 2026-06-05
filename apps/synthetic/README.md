# `@bench/app-synthetic`

A deterministic generator for a synthetic **extraction-target app** that mimics
a Next.js-pages-style codebase:

- `PAGES` page entries (`src/pages/*.page.tsx`) — these are the extractor entries.
- A shared pool of `POOL` components (`src/components/Shared*.tsx`).
- Each page imports a deterministic, **overlapping** subset (`IMPORTS_PER_PAGE`) of
  the pool, so shared components are reachable from many entries.
- Every file uses Lingui macros (`Trans`, `useLingui().t`).
- `FILLER_FNS` pure functions per file add realistic parse weight.

## Why this shape

The experimental extractor bundles each entry with esbuild `splitting:false`, so a
shared component is **inlined into — and re-parsed for — every entry that imports
it**. This generator reproduces that cost structure, which is what makes large
multi-entry projects slow. Tune `IMPORTS_PER_PAGE` / `POOL` / `FILLER_FNS` to dial
the shared-code-duplication load up or down.

## Usage

```bash
node generate.mjs --out <dir> [--preset light|heavy] [KEY=VAL ...]

# examples
node generate.mjs --out ../../runners/v6 --preset heavy
PAGES=200 IMPORTS_PER_PAGE=40 node generate.mjs --out ../../runners/v6 --preset heavy
```

Deterministic: same params ⇒ byte-identical output, so different runners extract
the exact same source (fair A/B). Presets live in `presets.mjs`.

## Extending

Add new app fixtures as sibling packages under `apps/` (e.g. `apps/deep-tree`,
`apps/wide`, or a real-framework fixture). Runners can target any app by
generating it into the runner dir before extracting.
