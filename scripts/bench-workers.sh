#!/usr/bin/env bash
# Worker-scaling benchmark for one runner: how wall-clock and peak memory change
# with --workers. Shows the optimal worker count and the (non-parallelizable)
# esbuild floor. Usage: bash scripts/bench-workers.sh runners/v6
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

RUNNER=${1:-runners/v6}
WORKERS=(${WORKERS_LIST:-1 2 4 8 16})

echo "host: $(nproc) cores | runner: $RUNNER"
printf "%-9s %-7s %-9s %-10s %s\n" "workers" "exit" "time" "peakRSS" "po_files"
for w in "${WORKERS[@]}"; do
  read -r secs code mb po < <(run_extract "$RUNNER" "$w" "/tmp/bench-workers-w${w}.log")
  printf "%-9s %-7s %7.2fs %7sMB %s\n" "$w" "$code" "$secs" "$mb" "$po"
done
