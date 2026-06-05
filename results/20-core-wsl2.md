# Results — 20-core WSL2 box

Hardware: 20 logical cores, WSL2 (Linux 6.6), Node 22. App: `synthetic --preset heavy`
(120 pages × 80 filler-fns, 150 shared components, **20 locales**, ~5.8 MB source,
2400 `.po` files, ~344 messages per entry catalog).

> Numbers are machine-specific; reproduce on your own hardware with `pnpm run bench:all`.

## Worker scaling (v6.2.0)

| workers | time | peak RSS |
|--------:|-----:|---------:|
| 1  | 16.51s |  330 MB |
| 3  |  9.87s |  807 MB |
| 8  |  8.78s | 1605 MB |
| 16 |  9.57s | 2068 MB |

Sweet spot ≈ 3–8 workers. Beyond that, time regresses and **peak memory grows
roughly linearly with worker count** (each worker holds a full bundle + AST).
The lag on real projects is memory pressure, not lack of cores.

## Three-way end-to-end — old vs new lingui vs native Rust extractor

Identical app. `v6 + rust` = lingui 6.2.0 with `createSwcExtractor()` (lingui-swc
0.6.0) swapped in via `lingui.swc.config.mjs` — same experimental flow, SWC
replaces Babel for the bundle parse only.

| config | w=1 time | w=1 RSS | w=8 time | w=8 RSS | po |
|--------|---------:|--------:|---------:|--------:|---:|
| v5.9.2 (Babel) | 17.01s | 314 MB | 9.29s | 1545 MB | 2400 |
| v6.2.0 (Babel) | 14.11s | 311 MB | 9.04s | 1490 MB | 2400 |
| v6.2.0 + Rust (lingui-swc) | **12.08s** | 312 MB | **7.69s** | **856 MB** | 2400 |

All three produce identical catalogs (2400 `.po`). Takeaways:

- **Drop-in Rust extractor: ~15% faster at w=8 and ~43% less peak memory** (856 MB
  vs 1490 MB) — the memory drop matters most, since memory pressure is what makes
  the machine lag.
- The speedup is "only" ~15% (not the 49× raw throughput below) because in the
  experimental flow the Rust extractor replaces just the Babel bundle-parse phase
  (~20%); **esbuild bundling (~44%) and catalog writing (~36%) are untouched.**
- v5→v6→Rust stacks to **~29% at w=1** end-to-end.

## Version A/B — v5.9.2 vs v6.2.0 (identical app)

| workers | v5.9.2 | v6.2.0 | speedup |
|--------:|-------:|-------:|--------:|
| 1 (median of 3) | 15.49s | 12.84s | **~17%** |
| 3 | 10.30s |  9.49s | ~8% |
| 8 |  8.75s |  8.00s | ~9% |

v6's gain is concentrated in the merge+write phase (see below); it does **not**
touch the esbuild/Babel core. New perf changes 5.9.2→6.2.0: `#2540` (mergeCatalog
key partitioning) + `#2548` (`pofile-ts`).

## Phase breakdown (single-thread)

| phase | v5.9.2 | v6.2.0 | parallel across workers? |
|-------|-------:|-------:|:--|
| esbuild bundle (incl. macro transform) | 5.80s (36.8%) | 5.63s (**43.8%**) | ❌ runs once, before the pool |
| Babel parse bundle + collect | 2.87s (18.2%) | 2.59s (20.2%) | ✅ |
| mergeCatalog + write .po | **7.08s (44.9%)** | 4.62s (36.0%) | ✅ |
| total | 15.75s | 12.85s | |

- On **v5**, merge+write is the biggest phase (45%). v6 cut it 35% (7.08→4.62s),
  which is essentially the entire v6 improvement.
- **esbuild bundling is the non-parallelizable wall-clock floor** in multi-worker
  runs (~5.6s) — more workers can never remove it. It also re-parses shared code
  once per entry.

## Raw extractor throughput — Babel vs native Rust (lingui-swc), 270 source files

| extractor | time | messages | speedup |
|-----------|-----:|---------:|--------:|
| Babel, single-thread | 4404 ms | 3210 | 1× |
| lingui-swc, single-thread | 959 ms | 3210 | **4.6×** |
| lingui-swc, Rayon parallel | 90 ms | 3210 | **48.8×** |

Message counts match exactly (correctness parity). Native extraction is so fast
that, in a rewritten pipeline, **catalog writing — not parsing — becomes the
bottleneck.**
