#!/usr/bin/env bash
# A/B benchmark: Lingui v5.9.2 vs v6.2.0 on the IDENTICAL generated app, across
# a few worker counts, with peak-memory sampling.
# Usage: bash scripts/bench-ab-version.sh
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

WORKERS=(${WORKERS_LIST:-1 3 8})

echo "host: $(nproc) cores | identical synthetic app"
for runner in runners/v5 runners/v6; do
  ver=$(node -e "console.log(require('$REPO_ROOT/$runner/node_modules/@lingui/cli/package.json').version)")
  echo "--- $runner (lingui $ver) ---"
  printf "  %-9s %-7s %-9s %-10s %s\n" "workers" "exit" "time" "peakRSS" "po_files"
  for w in "${WORKERS[@]}"; do
    read -r secs code mb po < <(run_extract "$runner" "$w" "/tmp/ab-${runner//\//-}-w${w}.log")
    printf "  %-9s %-7s %7.2fs %7sMB %s\n" "$w" "$code" "$secs" "$mb" "$po"
  done
done
