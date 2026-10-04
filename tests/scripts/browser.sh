#!/usr/bin/env bash
# Runs the browser tests (visual regression and integration) in their container.
#
#   browser.sh                          both projects
#   browser.sh --project=visual         screenshots only
#   browser.sh --project=integration    browser behaviour only
#   browser.sh --update                 replace changed screenshots (open every
#                                       changed image before keeping it)
#   browser.sh [--update] --grep "Trash"   only the tests whose name matches
#
# The container sees the repo read-only. It writes only its results
# (frontend/tests/.results) and, with --update, testdata/visual. It
# runs with no network: the packages are installed when the image is built.
set -euo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
update=""
if [[ "${1:-}" == "--update" ]]; then
  update="--update-snapshots=changed"
  shift
fi

# One image per lockfile, so a dependency change rebuilds it.
lock_hash="$(shasum -a 256 "$repo/frontend/package-lock.json" | cut -c1-12)"
image="bava-browser:$lock_hash"
if ! docker image inspect "$image" >/dev/null 2>&1; then
  docker build -t "$image" -f "$repo/tests/docker/browser.Dockerfile" "$repo/frontend"
fi

results="$repo/frontend/tests/.results"
# The package volume mounts over frontend/node_modules, which a fresh checkout
# (CI) does not have; Docker cannot make it inside the read-only repo.
mkdir -p "$results" "$repo/testdata/visual" "$repo/frontend/node_modules"
rm -rf "$results/output" "$results/orphans.txt"

mounts=(
  -v "$repo:/repo:ro"
  -v "bava-browser-modules-$lock_hash:/repo/frontend/node_modules"
  -v "$results:/repo/frontend/tests/.results"
)
[[ -n "$update" ]] && mounts+=(-v "$repo/testdata/visual:/repo/testdata/visual")

status=0
docker run --rm --network none --ipc host "${mounts[@]}" -w /repo/frontend "$image" \
  npx playwright test -c tests/playwright.config.ts $update "$@" || status=$?

# The references a full run never compared (the reporter in
# frontend/tests/harness/orphans.ts writes the list).
[[ -f "$results/orphans.txt" ]] && cat "$results/orphans.txt"
exit "$status"
