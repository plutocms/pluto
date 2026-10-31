#!/usr/bin/env bash
# Usage: plutocms-fanout.sh [owner/repo ...]
#
# The same file is in every Pluto package (.github/scripts/). The `fanout` job
# of release.yml runs it after a release, with a token of the plutocms-release
# GitHub App. Locally it needs `gh` signed in with access to the repos.
#
# Starts the "Update @plutocms" workflow (plutocms-update.yml) in every repo
# that uses @plutocms packages, and waits for it. Each run moves the @plutocms
# dependencies to the newest versions on npm, runs ci.yml, and merges when it
# is green. Run it after a release reaches npm.
#
# Two waves: the layers first, then the apps (templates, docs, outside apps),
# only when every layer is merged or up to date. A release that breaks a layer
# then stops at that layer, and the apps stay on the versions they have.
#
# Prints one line for each repo (merged, up to date, or failed) and the time.
# Exits 1 when a run failed. With arguments, it runs one wave with those repos.
# Needs GH_TOKEN (or a signed-in gh) that can start workflows in those repos.
set -u

# Wave 1: the Pluto packages that depend on other @plutocms packages.
LAYERS=(
  plutocms/pluto
  plutocms/supabase
  plutocms/docs
  plutocms/supabase-shop
  plutocms/supabase-blog
)
# Wave 2: the Pluto org apps.
PLUTO_APPS=(
  plutocms/pluto-admin-template
  plutocms/pluto-blog-template
  plutocms/pluto-supabase-shop-template
  plutocms/plutocms
)
# Wave 2 too: apps outside the Pluto org, from PLUTO_FANOUT_APPS (owner/repo,
# separated by spaces). Each needs its own copy of plutocms-update.yml and the
# repo setting "Allow GitHub Actions to create and approve pull requests".
read -r -a APPS <<< "${PLUTO_FANOUT_APPS:-}"

start=$(date +%s)

# Runs one wave: starts the workflow in each repo at once, then waits for all.
# Returns the number of failed repos.
run_wave() {
  local label=$1
  shift
  local repos=("$@")
  local since
  since=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  echo "== $label"
  for repo in "${repos[@]}"; do
    gh workflow run plutocms-update.yml -R "$repo" >/dev/null || echo "$repo: could not start the workflow"
  done

  declare -A run
  for repo in "${repos[@]}"; do
    local id=''
    for _ in $(seq 1 30); do
      id=$(gh run list -R "$repo" --workflow plutocms-update.yml --event workflow_dispatch --limit 5 \
        --json databaseId,createdAt -q "[.[] | select(.createdAt >= \"$since\")] | last | .databaseId // empty")
      [ -n "$id" ] && break
      sleep 2
    done
    run[$repo]=$id
  done

  local failed=0
  for repo in "${repos[@]}"; do
    local id=${run[$repo]}
    if [ -z "$id" ]; then
      echo "$repo: no run found"
      failed=$((failed + 1))
      continue
    fi
    gh run watch "$id" -R "$repo" --interval 10 --exit-status >/dev/null 2>&1
    local jobs conclusion
    jobs=$(gh run view "$id" -R "$repo" --json jobs -q '[.jobs[] | "\(.name)=\(.conclusion)"] | join(" ")')
    conclusion=$(gh run view "$id" -R "$repo" --json conclusion -q .conclusion)
    if [ "$conclusion" != success ]; then
      echo "$repo: FAILED ($jobs) https://github.com/$repo/actions/runs/$id"
      failed=$((failed + 1))
    elif echo "$jobs" | grep -q "Merge=success"; then
      local end
      end=$(gh run view "$id" -R "$repo" --json updatedAt -q '.updatedAt | fromdateiso8601')
      echo "$repo: merged ($(( end - start ))s after the start)"
    else
      echo "$repo: up to date"
    fi
  done
  return "$failed"
}

if [ $# -gt 0 ]; then
  run_wave "repos" "$@"
  failed=$?
else
  run_wave "wave 1: layers" "${LAYERS[@]}"
  failed=$?
  if [ "$failed" -gt 0 ]; then
    echo "wave 2 skipped: $failed layer(s) failed. Fix them, then run: scripts/plutocms-fanout.sh ${PLUTO_APPS[*]} ${APPS[*]}"
  else
    run_wave "wave 2: apps" "${PLUTO_APPS[@]}" "${APPS[@]}"
    failed=$?
  fi
fi

echo "fan-out: $(( $(date +%s) - start ))s"
[ "$failed" -eq 0 ]
