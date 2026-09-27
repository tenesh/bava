#!/usr/bin/env bash
# Runs the screen checks (layer 2) in their container.
#
#   visual.sh            compare with the approved screenshots
#   visual.sh --update   replace them (open every changed image before keeping it)
#   visual.sh [--update] --grep "Trash"   only the walks whose name matches
#
# The container sees the repo read-only. It writes only its results
# (frontend/tests/visual/.results) and, with --update, testdata/visual. It
# runs with no network: the packages are installed when the image is built.
set -euo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
update=""
if [[ "${1:-}" == "--update" ]]; then
  update="--update-snapshots"
  shift
fi

# One image per lockfile, so a dependency change rebuilds it.
lock_hash="$(shasum -a 256 "$repo/frontend/package-lock.json" | cut -c1-12)"
image="bava-visual:$lock_hash"
if ! docker image inspect "$image" >/dev/null 2>&1; then
  docker build -t "$image" -f "$repo/tests/docker/visual.Dockerfile" "$repo/frontend"
fi

results="$repo/frontend/tests/visual/.results"
# The package volume mounts over frontend/node_modules, which a fresh checkout
# (CI) does not have; Docker cannot make it inside the read-only repo.
mkdir -p "$results" "$repo/testdata/visual" "$repo/frontend/node_modules"
rm -rf "$results/output"

mounts=(
  -v "$repo:/repo:ro"
  -v "bava-visual-modules-$lock_hash:/repo/frontend/node_modules"
  -v "$results:/repo/frontend/tests/visual/.results"
)
[[ -n "$update" ]] && mounts+=(-v "$repo/testdata/visual:/repo/testdata/visual")

docker run --rm --network none --ipc host "${mounts[@]}" -w /repo/frontend "$image" \
  npx playwright test -c tests/visual/playwright.config.ts $update "$@"
