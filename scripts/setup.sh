#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Home Hub setup: creates the GitHub repo, pushes this code, creates the
# Firebase project, enables Firestore, registers the web app, and wires up
# GitHub Actions auto-deploy.
#
# Run this from your own terminal (it needs real internet access, which the
# sandbox that generated this repo doesn't have). It's split into numbered
# steps and each risky/version-dependent step fails soft with manual
# fallback instructions printed, rather than aborting the whole script.
#
# Two things this script CANNOT do (no CLI exists for these — Firebase
# Console only): enabling the Email/Password and Google sign-in providers
# under Authentication. Step 5 stops and tells you exactly where to click.
#
# Usage:
#   cd home-hub
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
#
# Override any default by exporting it first, e.g.:
#   FIREBASE_PROJECT_ID=my-own-id ./scripts/setup.sh
#
# The step 3 logic (ensure_firebase_project) is pulled out into its own
# function so scripts/setup.test.sh can source this file and exercise it
# directly, with a stubbed `firebase` command, instead of needing a real
# Firebase account to test against. Sourcing this file only defines
# functions/variables — nothing runs until main() is called, which only
# happens automatically when this file is executed directly (see the guard
# at the bottom).
# ---------------------------------------------------------------------------
set -uo pipefail

GITHUB_USER="${GITHUB_USER:-vivekvangal}"
REPO_NAME="${REPO_NAME:-home-hub}"
REPO_VISIBILITY="${REPO_VISIBILITY:-public}"       # public | private
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-home-hub-family}"
FIREBASE_DISPLAY_NAME="${FIREBASE_DISPLAY_NAME:-Home Hub}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-nam5}"    # nam5 = multi-region US; change if you want a specific region

bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
warn() { printf '  ⚠️  %s\n' "$1"; }
ok()   { printf '  ✓ %s\n' "$1"; }

# Creates the Firebase project if it doesn't already exist. Treats
# "already exists" as a successful, idempotent no-op rather than a hard
# failure — `firebase projects:list` can lag behind reality (propagation
# delay, or limited IAM visibility into who else's projects exist), so
# relying on it alone to detect an existing project isn't reliable enough to
# justify aborting the whole script when `projects:create` fails only
# because the project is already there. Any other kind of failure still
# just warns and lets the rest of the script run, same as every other
# soft-failing step here (e.g. step 4's Firestore creation) — a missing
# project surfaces its own clear errors in later steps rather than needing
# this one to guess right about every possible failure mode.
ensure_firebase_project() {
  local project_id="$1"
  local display_name="$2"

  if firebase projects:list 2>/dev/null | grep -q "$project_id"; then
    ok "Project $project_id already exists — skipping creation."
    return 0
  fi

  local output status
  output="$(firebase projects:create "$project_id" --display-name "$display_name" 2>&1)"
  status=$?
  echo "$output"

  if [ "$status" -eq 0 ]; then
    ok "Created project $project_id"
  elif echo "$output" | grep -qi "already exists"; then
    ok "Project $project_id already exists (projects:list just didn't show it) — continuing."
  else
    warn "Couldn't create that project id (maybe already taken globally). Create one manually at https://console.firebase.google.com, then re-run with FIREBASE_PROJECT_ID=<your-id> ./scripts/setup.sh"
  fi
}

main() {
# --- 0. Sanity checks -------------------------------------------------------
bold "0. Checking required tools"
for cmd in git node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required tool: $cmd. Install it and re-run this script."
    exit 1
  fi
done
ok "git, node, npm found"

HAVE_GH=false
command -v gh >/dev/null 2>&1 && HAVE_GH=true
if $HAVE_GH; then ok "GitHub CLI (gh) found"; else warn "GitHub CLI not found — install from https://cli.github.com for repo automation, or create/push the repo manually (instructions below)."; fi

if ! command -v firebase >/dev/null 2>&1; then
  bold "Installing firebase-tools globally (npm install -g firebase-tools)..."
  npm install -g firebase-tools
fi
ok "firebase-tools found"

# firebase-tools reads .firebaserc on startup for basically any command —
# including 'firebase login' — and errors out immediately if the "default"
# project id in it isn't a validly-formatted project id. It ships in this
# repo with a literal placeholder, so this has to be fixed before we call
# firebase-tools for anything at all.
if [ -f .firebaserc ] && grep -q REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID .firebaserc; then
  sed -i.bak "s/REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID/$FIREBASE_PROJECT_ID/" .firebaserc && rm -f .firebaserc.bak
  ok "Updated .firebaserc -> $FIREBASE_PROJECT_ID (before touching firebase-tools at all)"
fi

# Make sure we're on 'main' before creating/pushing the GitHub repo — the
# deploy workflow only triggers on pushes to main, and plain 'git init'
# defaults to 'master' unless your global git config says otherwise.
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || echo '')"
if [ "$CURRENT_BRANCH" != "main" ]; then
  git branch -M main
  ok "Renamed local branch '$CURRENT_BRANCH' -> main"
fi

# --- 1. GitHub repo: create + push ------------------------------------------
bold "1. GitHub repo"
if git remote get-url origin >/dev/null 2>&1; then
  ok "git remote 'origin' already set — skipping repo creation, pushing latest instead."
  git push -u origin main || warn "Push failed — check your git auth and try 'git push -u origin main' manually."
elif $HAVE_GH; then
  if ! gh auth status >/dev/null 2>&1; then
    warn "Run 'gh auth login' first, then re-run this script."
    exit 1
  fi
  echo "Creating $GITHUB_USER/$REPO_NAME ($REPO_VISIBILITY) and pushing..."
  gh repo create "$GITHUB_USER/$REPO_NAME" --"$REPO_VISIBILITY" --source=. --remote=origin --push \
    && ok "Repo created and pushed: https://github.com/$GITHUB_USER/$REPO_NAME" \
    || warn "gh repo create failed — see output above."
else
  warn "No 'gh' CLI available. Create the repo at https://github.com/new (name: $REPO_NAME), then run:"
  echo "     git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git"
  echo "     git push -u origin main"
fi

# --- 2. Firebase login -------------------------------------------------------
bold "2. Firebase login"
firebase login || { warn "Firebase login failed/cancelled — re-run this script after logging in."; exit 1; }

# --- 3. Create the Firebase project ------------------------------------------
bold "3. Firebase project: $FIREBASE_PROJECT_ID"
ensure_firebase_project "$FIREBASE_PROJECT_ID" "$FIREBASE_DISPLAY_NAME"

# --- 4. Create the Firestore database ----------------------------------------
bold "4. Firestore database"
firebase firestore:databases:create '(default)' --project "$FIREBASE_PROJECT_ID" --location "$FIRESTORE_LOCATION" 2>/dev/null \
  && ok "Firestore database created ($FIRESTORE_LOCATION)" \
  || warn "Couldn't auto-create Firestore (may already exist, or this firebase-tools version uses different flags). If needed, create it manually: Firebase Console -> Build -> Firestore Database -> Create database -> production mode."

# --- 5. Enable sign-in providers (MANUAL — no CLI for this) -----------------
bold "5. Enable sign-in providers — this step is manual, there's no CLI for it"
echo "   Open: https://console.firebase.google.com/project/$FIREBASE_PROJECT_ID/authentication/providers"
echo "   Enable: Email/Password, and Google (pick a support email when prompted)."
read -rp "   Press Enter once you've enabled both providers... " _

# --- 6. Register the web app and fetch its config ----------------------------
bold "6. Register web app + fetch SDK config"
firebase apps:create web "$FIREBASE_DISPLAY_NAME" --project "$FIREBASE_PROJECT_ID" 2>/dev/null \
  || warn "Web app may already exist for this project — continuing."

echo "   Fetching config (this prints either JSON or a JS snippet depending on your firebase-tools version)..."
firebase apps:sdkconfig web --project "$FIREBASE_PROJECT_ID" || true
cat <<'EOF'

   Copy the 6 values above into frontend/.env.local (copy from
   frontend/.env.local.example first if you haven't already):
     VITE_FIREBASE_API_KEY=
     VITE_FIREBASE_AUTH_DOMAIN=
     VITE_FIREBASE_PROJECT_ID=
     VITE_FIREBASE_STORAGE_BUCKET=
     VITE_FIREBASE_MESSAGING_SENDER_ID=
     VITE_FIREBASE_APP_ID=
EOF
read -rp "   Press Enter once frontend/.env.local is filled in... " _

# --- 7. Install deps, run tests, deploy Firestore rules -----------------------
bold "7. Install + test"
(cd frontend && npm install && npm test) || { warn "npm install/test failed — fix and re-run before deploying."; exit 1; }

bold "Deploying Firestore rules + indexes"
firebase deploy --only firestore:rules,firestore:indexes --project "$FIREBASE_PROJECT_ID" \
  && ok "Firestore rules deployed" \
  || warn "Rules deploy failed — check the error above."

# --- 8. Wire up GitHub Actions auto-deploy -----------------------------------
bold "8. GitHub Actions auto-deploy"
if $HAVE_GH && git remote get-url origin >/dev/null 2>&1; then
  echo "   Running 'firebase init hosting:github' — this is Firebase's official wizard for"
  echo "   wiring up the FirebaseExtended/action-hosting-deploy GitHub Action: it creates a"
  echo "   service account and adds the needed secret to your GitHub repo automatically."
  echo "   Answer its prompts (say yes to setting up a workflow — you can overwrite ours or"
  echo "   decline overwriting to keep the one already in .github/workflows/deploy.yml)."
  firebase init hosting:github --project "$FIREBASE_PROJECT_ID" || warn "hosting:github wizard didn't complete — you can add FIREBASE_SERVICE_ACCOUNT as a GitHub secret manually instead (see README)."

  if [ -f frontend/.env.local ]; then
    echo "   Setting VITE_FIREBASE_* GitHub secrets from frontend/.env.local..."
    set -a
    # shellcheck disable=SC1091
    source frontend/.env.local
    set +a
    for var in VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID \
               VITE_FIREBASE_STORAGE_BUCKET VITE_FIREBASE_MESSAGING_SENDER_ID VITE_FIREBASE_APP_ID; do
      val="${!var:-}"
      if [ -n "$val" ]; then
        gh secret set "$var" -b"$val" && ok "Set secret $var" || warn "Failed to set $var"
      else
        warn "$var is empty in frontend/.env.local — set it manually as a GitHub secret."
      fi
    done
  fi
else
  warn "Skipping — needs both 'gh' and a git remote. See README's 'Publishing it for real' section to do this manually."
fi

bold "Done"
echo "Push to main (already done above if the repo was just created) to trigger the first deploy."
echo "Your app will be live at: https://$FIREBASE_PROJECT_ID.web.app"
}

# Only run main() when this file is executed directly (./scripts/setup.sh or
# bash scripts/setup.sh) — not when it's sourced (e.g. by setup.test.sh,
# which sources this file just to get ensure_firebase_project and friends
# without running the whole interactive setup).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
