#!/usr/bin/env bash
# Single-thread (workers=1) median over N runs for v5 vs v6 — the cleanest,
# lowest-noise comparison (no worker scheduling jitter). Usage: bash scripts/bench-ab-w1.sh
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

RUNS=${RUNS:-3}
echo "host: $(nproc) cores | workers=1 | runs=$RUNS (median)"
for runner in runners/v5 runners/v6; do
  ver=$(node -e "console.log(require('$REPO_ROOT/$runner/node_modules/@lingui/cli/package.json').version)")
  times=()
  for i in $(seq 1 "$RUNS"); do
    read -r secs _ _ _ < <(run_extract "$runner" 1 "/tmp/abw1-${runner//\//-}-${i}.log")
    times+=("$secs")
    printf "  %-14s run%-2s %ss\n" "lingui $ver" "$i" "$secs"
  done
  median=$(printf "%s\n" "${times[@]}" | sort -n | awk '{a[NR]=$1} END{print a[int((NR+1)/2)]}')
  echo "  => lingui $ver median: ${median}s"
done
