#!/usr/bin/env bash
# Shared helpers for the bench scripts.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# cli_path <runnerDir> -> absolute path to that runner's lingui.js
cli_path() { echo "$REPO_ROOT/$1/node_modules/@lingui/cli/dist/lingui.js"; }

# Sample summed RSS (KB) of the running lingui processes every 0.3s until the
# pidfile is removed; write peak (KB) to outfile.
sample_peak_rss() {
  local pidfile=$1 outfile=$2 peak=0
  while [ -f "$pidfile" ]; do
    local tot
    tot=$(ps -eo rss,args 2>/dev/null | grep "[e]xtract-experimental\|[l]ingui.js" | awk '{s+=$1} END{print s+0}')
    [ "$tot" -gt "$peak" ] && peak=$tot
    sleep 0.3
  done
  echo "$peak" > "$outfile"
}

# run_extract <runnerDir> <workers> <logfile> [configFile] -> prints "<seconds> <exitcode> <peakMB> <poCount>"
# configFile is optional and relative to the runner dir (e.g. lingui.swc.config.mjs).
run_extract() {
  local runner=$1 workers=$2 log=$3 config=${4:-}
  local cli; cli="$(cli_path "$runner")"
  local cfgArg=""; [ -n "$config" ] && cfgArg="--config $config"
  ( cd "$REPO_ROOT/$runner" && rm -rf src/locales .lingui )
  local pidfile rssfile; pidfile=$(mktemp); rssfile=$(mktemp); touch "$pidfile"
  sample_peak_rss "$pidfile" "$rssfile" & local sampler=$!
  local s e code
  s=$(date +%s.%N)
  ( cd "$REPO_ROOT/$runner" && node "$cli" extract-experimental --workers "$workers" $cfgArg ) > "$log" 2>&1
  code=$?
  e=$(date +%s.%N)
  rm -f "$pidfile"; wait "$sampler" 2>/dev/null
  local mb po
  mb=$(awk -v k="$(cat "$rssfile")" 'BEGIN{printf "%.0f", k/1024}')
  po=$(find "$REPO_ROOT/$runner/src/locales" -name "*.po" 2>/dev/null | wc -l)
  rm -f "$rssfile"
  echo "$(echo "$e - $s" | bc) $code $mb $po"
}
