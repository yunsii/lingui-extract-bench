# Findings & design notes

## 1. How the experimental extractor works

`lingui extract-experimental` is **entry-point based** (unlike the default
glob extractor that merges everything into one catalog). For each entry:

1. **esbuild** bundles the entry's import tree (`bundle:true`, `splitting:false`),
   running a Babel **macro transform** on each source file during the bundle.
2. The bundle is **Babel-parsed again** to collect messages.
3. Messages are merged into a per-entry catalog and **written** as `.po`
   (one file per locale).

Worker pool (`--workers`) parallelizes steps 2–3 **per bundle**. Step 1 (esbuild)
runs once, before the pool.

## 2. Where the time goes (measured)

See [`../results/20-core-wsl2.md`](../results/20-core-wsl2.md). Summary on a heavy
synthetic app (120 entries × 20 locales), single-thread, v6.2.0:

| phase | share | parallel? |
|-------|------:|:--|
| esbuild bundle | **43.8%** | ❌ (the wall-clock floor) |
| mergeCatalog + write `.po` | 36.0% | ✅ |
| Babel parse + collect | 20.2% | ✅ |

Two structural problems:

- **`splitting:false` ⇒ shared code is duplicated** into every entry's bundle and
  re-parsed each time. Cost scales with `entries × shared-code`, not total source.
- **esbuild bundling does not parallelize** across the worker pool, so it caps the
  achievable wall-clock no matter how many cores you have.

And the practical pain on real projects is **memory**: peak RSS grows ~linearly
with `--workers` (each worker holds a full bundle + AST), so cranking workers
makes the machine swap/lag rather than finish faster.

## 3. Does upgrading help?

v5.9.2 → v6.2.0 is **~8–10% at typical worker counts** (~17% single-thread). The
gain is entirely in merge+write (`#2540` mergeCatalog, `#2548` `pofile-ts`); the
esbuild/Babel core is unchanged. Upgrade for the free win + maintenance, but it is
**not** a fix for the bottleneck. Note the v6 breaking change: `format: 'po'` →
`formatter()` from `@lingui/format-po`.

## 4. Prior art for a rewrite (important)

The Lingui maintainer is already pursuing a native extractor — see
[lingui/js-lingui#2436](https://github.com/lingui/js-lingui/issues/2436):

- **`@lingui/swc-plugin`** — the Lingui macro implemented in Rust/SWC, at feature
  parity with the Babel macro (the hard part: `generate_id`, JSX serialization,
  ICU, placeholder naming).
- **`lingui-swc`** (npm) — a **native napi-rs extractor** built on that macro,
  using **Rayon** for parallel multi-file extraction. Passes the original test
  suite 100%; drop-in via `createSwcExtractor()`. The macro logic is shared
  between the WASM plugin and the native extractor via one `lingui_macro` crate.

Reference impl to read: `timofei-iatsenko/lingui-rust-tools`
(`crates/lingui_extractor`).

Measured here: native extraction is **4.6× single-thread / ~49× with Rayon** vs
Babel on the same files, with identical message output.

## 5. The dependency-graph rewrite (design)

The existing native work replaces step 2 (per-file parse) but **keeps esbuild for
the dependency crawl** — so the 44% esbuild floor stays. The bigger win is to
replace esbuild itself with a **resolver-driven, parse-once, per-node-catalog**
crawl.

### Architecture

```
1. Resolver layer        — oxc_resolver: import specifier -> absolute path.
                           Native tsconfig paths / exports / imports support.
                           (Removes the need for tsconfig-paths esbuild hacks.)
2. Graph crawl (dedup)   — parse each file ONCE; build the module graph.
3. Per-node catalog      — each module owns only the messages defined in itself.
4. Per-entry aggregation — for each entry, union the catalogs of its reachable
                           subgraph (cheap in-memory set-union, dedup by id).
5. Write                 — per entry × locale, merge + write .po (Rayon parallel).
```

### Parse-once / the "hold concurrent requests" concern

Two ways to guarantee each file is parsed once:

- **In-flight memoization (the async "hold")** — `DashMap<FileId,
  Shared<Future<Arc<ModuleCatalog>>>>`. The first requester inserts a shared
  future; concurrent requesters clone and await the same future. This is exactly
  "if two paths hit the same node, hold until it completes."
- **Two-phase (recommended, simpler & more parallel)** —
  1. *discover*: BFS from entries, dedup via a `visited` set → the unique module set + edges;
  2. *extract*: `rayon::par_iter` over the unique set → each `ModuleCatalog` (this is the ~90ms/270-files step);
  3. *aggregate*: per entry, walk the reachable subgraph and union node catalogs.

  The two-phase split decouples dedup from extraction and gives clean,
  maximal parallelism without shared-future plumbing.

### Why it wins

- **Parse-once**: a shared module is parsed once total, not once per entry.
- **No bundling**: the entire ~44% esbuild floor disappears, replaced by
  resolve + parse (a sub-second, fully parallel step).
- **Native parallelism**: Rust threads / Rayon, no Node worker spawn or
  structured-clone overhead.
- **Memory**: only small per-module catalogs are retained; ASTs are freed right
  after extraction (no multi-GB bundle residency).

### oxc vs SWC

- **Use SWC for parse + macro + extract.** The macro is already implemented,
  tested, and factored into a shared crate. oxc uses a structurally different,
  arena-lifetime AST — porting the macro to oxc is a **full rewrite with zero
  reuse**, against a pre-1.0 (0.x) library API, for a step that is already not the
  bottleneck (~90 ms for 270 files).
- **Adopt `oxc_resolver` for the resolution layer only** — it is best-in-class and
  independently usable (knip/swc-node pair it with non-oxc parsers). This is the
  one place oxc clearly beats SWC.

### Projected metrics (extrapolated from this repo's measurements)

| | current v6 (8 workers) | dep-graph rewrite (projected) |
|--|--:|--:|
| crawl + parse + extract | esbuild 5.6s + Babel 2.6s | **< 0.5s** |
| merge + write (2400 .po) | 4.6s | ~1–1.5s (Rust + Rayon) → **new bottleneck** |
| peak RSS | 0.8–2 GB | **hundreds of MB** |
| **wall-clock** | **~8s** | **~1.5–2s (≈4–5×)** |

KPIs to track in an implementation:

1. **parse-once invariant**: `files parsed == unique modules` (today it is
   `Σ per-entry reachable files`).
2. **wall-clock scales with unique modules**, not `entries × shared-code`.
3. **peak RSS** drops from GB-class to hundreds of MB.
4. **write becomes the dominant phase** — optimize via parallel writes, fewer
   files, or a binary intermediate format.

## 6. Feasibility verdict (measured)

The three-way end-to-end run (see [`../results/20-core-wsl2.md`](../results/20-core-wsl2.md))
grounds the decision:

| step | what it buys | cost / risk |
|------|--------------|-------------|
| Upgrade v5 → v6 | ~8–17% (merge+write only) | small; one breaking change (`format` → `formatter()`) |
| **Drop in `createSwcExtractor()`** | **~15% faster + ~43% less RAM at w=8, zero code** | low; native binary dep, line/col mapping differs slightly |
| Dep-graph rewrite (no esbuild) | projected ~4–5× + GB→MB RAM | high; new crawler + writer, but macro/extract already exist |

**Recommended sequencing (lowest risk first):**

1. **Now, free:** upgrade to v6 and add `createSwcExtractor()`. Stacks to ~29%
   wall-clock and a large memory cut with no architecture change. This alone fixes
   most of the "machine lags" symptom (memory).
2. **The real lever:** replace esbuild with a resolver-driven, parse-once,
   per-node-catalog crawl (§5), reusing the existing `lingui_macro`/
   `lingui_extractor` SWC crates and `oxc_resolver`. This removes the ~44%
   non-parallelizable floor and the shared-code re-parse, and is the only path to
   the ~4–5× projection.
3. **Do not** rewrite the macro on oxc — no reuse, unstable 0.x API, and parsing
   is already not the bottleneck once native (raw extract is ~90 ms / 270 files).

**Bottom line:** the new approach is feasible and worthwhile, but its value comes
from killing esbuild's bundling — not from the parser choice. The hardest part
(macro semantics + ID generation) is already solved in Rust/SWC and is fully
deterministic; the new work is orchestration (graph crawl + aggregation + parallel
write).
