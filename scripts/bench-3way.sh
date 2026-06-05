#!/usr/bin/env bash
# Three-way end-to-end benchmark on the IDENTICAL generated app:
#   1. lingui v5.9.2            (Babel extractor)
#   2. lingui v6.2.0            (Babel extractor)
#   3. lingui v6.2.0 + lingui-swc (native Rust/SWC extractor, --config lingui.swc.config.mjs)
# Reports wall-clock, peak RSS and .po count per worker setting.
# Usage: bash scripts/bench-3way.sh    (assumes `pnpm run gen` already ran)
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

WORKERS=(${WORKERS_LIST:-1 8})

row() { # <label> <runner> <workers> <configFile>
  local label=$1 runner=$2 w=$3 cfg=${4:-}
  read -r secs code mb po < <(run_extract "$runner" "$w" "/tmp/3way-${label// /_}-w${w}.log" "$cfg")
  printf "  %-22s w=%-3s exit=%s %7.2fs %7sMB po=%s\n" "$label" "$w" "$code" "$secs" "$mb" "$po"
}

echo "host: $(nproc) cores | identical synthetic app"
v5=$(node -e "console.log(require('$REPO_ROOT/runners/v5/node_modules/@lingui/cli/package.json').version)")
v6=$(node -e "console.log(require('$REPO_ROOT/runners/v6/node_modules/@lingui/cli/package.json').version)")
swc=$(node -e "console.log(require('$REPO_ROOT/runners/v6/node_modules/lingui-swc/package.json').version)")
echo "versions: lingui v5=$v5  v6=$v6  lingui-swc=$swc"
for w in "${WORKERS[@]}"; do
  row "v5 (babel)"        runners/v5 "$w"
  row "v6 (babel)"        runners/v6 "$w"
  row "v6 + rust (swc)"   runners/v6 "$w" "lingui.swc.config.mjs"
done
