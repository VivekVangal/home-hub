#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Plain-bash tests for scripts/setup.sh's ensure_firebase_project function —
# specifically the idempotency bug fixed here: step 3 used to exit 1 when
# `firebase projects:create` failed because the project already existed,
# instead of treating that as the harmless no-op it actually is.
#
# There's no existing shell-test framework in this repo (everything else is
# vitest), so this just runs each scenario, checks stdout/exit status by
# hand, and prints PASS/FAIL — run it directly:
#   bash scripts/setup.test.sh
# Exits 0 if every case passes, 1 otherwise (so it can be wired into CI later
# if this script gets touched often enough to be worth it).
# ---------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Sourcing setup.sh only defines functions/variables (see the
# BASH_SOURCE/0 guard at its bottom) — it does not run the interactive
# setup, so this is safe to do without a real Firebase account.
source scripts/setup.sh

FAILURES=0

pass() { printf '  ✓ %s\n' "$1"; }
fail() { printf '  ✗ %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

# Stubs the `firebase` command for the duration of one test case. Uses
# script-global STUB_* variables rather than locals, since a bash function's
# `local`s are destroyed the moment it returns — and the `firebase` function
# defined here gets called later, after run_with_stub has already returned.
# $1 = what `firebase projects:list` should print (grep target)
# $2 = exit status `firebase projects:create` should return
# $3 = what `firebase projects:create` should print to stdout/stderr
run_with_stub() {
  STUB_LIST_OUTPUT="$1"
  STUB_CREATE_STATUS="$2"
  STUB_CREATE_OUTPUT="$3"
  firebase() {
    case "$1" in
      projects:list) echo "$STUB_LIST_OUTPUT" ;;
      projects:create)
        echo "$STUB_CREATE_OUTPUT"
        return "$STUB_CREATE_STATUS"
        ;;
    esac
  }
}

# --- Case 1: project already shows up in `projects:list` -------------------
run_with_stub "home-hub-family-dev" 0 ""
output="$(ensure_firebase_project home-hub-family-dev 'Home Hub Dev' 2>&1)"
if echo "$output" | grep -q "already exists — skipping creation"; then
  pass "project already in projects:list -> skips creation, no error"
else
  fail "project already in projects:list -> expected a skip message, got: $output"
fi

# --- Case 2: project doesn't exist yet, create succeeds ---------------------
run_with_stub "" 0 "Created project"
output="$(ensure_firebase_project home-hub-family-dev 'Home Hub Dev' 2>&1)"
status=$?
if [ "$status" -eq 0 ] && echo "$output" | grep -q "Created project home-hub-family-dev"; then
  pass "project missing, create succeeds -> reports created, exits 0"
else
  fail "project missing, create succeeds -> expected success message + exit 0, got status=$status output: $output"
fi

# --- Case 3: the actual bug — projects:list misses it, and projects:create
# fails specifically because it already exists. This used to hard-exit the
# whole script; it should now be treated as a harmless no-op.
run_with_stub "" 1 "Error: Failed to create project. Project home-hub-family-dev already exists."
output="$(ensure_firebase_project home-hub-family-dev 'Home Hub Dev' 2>&1)"
status=$?
if [ "$status" -eq 0 ] && echo "$output" | grep -q "already exists (projects:list just didn't show it)"; then
  pass "projects:list misses it, create fails with 'already exists' -> soft-continues, exits 0 (the actual bug fix)"
else
  fail "projects:list misses it, create fails with 'already exists' -> expected a soft-continue message + exit 0, got status=$status output: $output"
fi

# --- Case 4: create fails for a real, different reason ----------------------
run_with_stub "" 1 "Error: Permission denied."
output="$(ensure_firebase_project home-hub-family-dev 'Home Hub Dev' 2>&1)"
status=$?
if [ "$status" -eq 0 ] && echo "$output" | grep -q "Couldn't create that project id"; then
  pass "create fails for an unrelated reason -> warns, still exits 0 (doesn't abort the whole script)"
else
  fail "create fails for an unrelated reason -> expected a warning + exit 0, got status=$status output: $output"
fi

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "All ensure_firebase_project tests passed."
  exit 0
else
  echo "$FAILURES ensure_firebase_project test(s) failed."
  exit 1
fi
