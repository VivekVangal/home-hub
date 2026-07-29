#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Creates a SEPARATE Firebase project for local development/testing, so that
# running the app locally (npm run dev) or testing new features never reads
# or writes real family data in the production project.
#
# This assumes scripts/setup.sh has already been run once for production
# (home-hub-family) — this script only sets up the second, dev-only project
# and a "develop" branch pipeline. It does NOT touch the production project
# or its data in any way.
#
# Run this from your own terminal (needs real internet + Firebase login).
#
# Usage:
#   cd home-hub
#   chmod +x scripts/setup-dev-env.sh
#   ./scripts/setup-dev-env.sh
#
# Override the default project id if you want:
#   FIREBASE_DEV_PROJECT_ID=my-id ./scripts/setup-dev-env.sh
# ---------------------------------------------------------------------------
set -uo pipefail

FIREBASE_DEV_PROJECT_ID="${FIREBASE_DEV_PROJECT_ID:-home-hub-family-dev}"
FIREBASE_DISPLAY_NAME="${FIREBASE_DISPLAY_NAME:-Home Hub (dev)}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-nam5}"

bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
warn() { printf '  ⚠️  %s\n' "$1"; }
ok()   { printf '  ✓ %s\n' "$1"; }

command -v firebase >/dev/null 2>&1 || { bold "Installing firebase-tools..."; npm install -g firebase-tools; }

# --- 1. Firebase login -------------------------------------------------------
bold "1. Firebase login"
firebase login || { warn "Firebase login failed/cancelled — re-run after logging in."; exit 1; }

# --- 2. Create the dev Firebase project --------------------------------------
bold "2. Firebase project: $FIREBASE_DEV_PROJECT_ID"
if firebase projects:list 2>/dev/null | grep -q "$FIREBASE_DEV_PROJECT_ID"; then
  ok "Project $FIREBASE_DEV_PROJECT_ID already exists — skipping creation."
else
  firebase projects:create "$FIREBASE_DEV_PROJECT_ID" --display-name "$FIREBASE_DISPLAY_NAME" \
    && ok "Created project $FIREBASE_DEV_PROJECT_ID" \
    || { warn "Couldn't create that project id (maybe already taken globally). Create one manually at https://console.firebase.google.com, then re-run with FIREBASE_DEV_PROJECT_ID=<your-id> ./scripts/setup-dev-env.sh"; exit 1; }
fi

# --- 3. Create the Firestore database ----------------------------------------
bold "3. Firestore database"
firebase firestore:databases:create '(default)' --project "$FIREBASE_DEV_PROJECT_ID" --location "$FIRESTORE_LOCATION" 2>/dev/null \
  && ok "Firestore database created ($FIRESTORE_LOCATION)" \
  || warn "Couldn't auto-create Firestore (may already exist). If needed: Firebase Console -> Build -> Firestore Database -> Create database -> production mode."

# --- 4. Enable sign-in providers (manual — no CLI for this) ------------------
bold "4. Enable sign-in providers — manual step"
echo "   Open: https://console.firebase.google.com/project/$FIREBASE_DEV_PROJECT_ID/authentication/providers"
echo "   Enable: Email/Password, and Google (pick a support email when prompted)."
read -rp "   Press Enter once you've enabled both providers... " _

# --- 5. Register the web app and fetch its config -----------------------------
bold "5. Register web app + fetch SDK config"
firebase apps:create web "$FIREBASE_DISPLAY_NAME" --project "$FIREBASE_DEV_PROJECT_ID" 2>/dev/null \
  || warn "Web app may already exist for this project — continuing."

echo "   Fetching config..."
firebase apps:sdkconfig web --project "$FIREBASE_DEV_PROJECT_ID" || true
cat <<'EOF'

   Copy the 6 values above into frontend/.env.local (this is what your LOCAL
   npm run dev uses — it should point at the DEV project, never production):
     VITE_FIREBASE_API_KEY=
     VITE_FIREBASE_AUTH_DOMAIN=
     VITE_FIREBASE_PROJECT_ID=
     VITE_FIREBASE_STORAGE_BUCKET=
     VITE_FIREBASE_MESSAGING_SENDER_ID=
     VITE_FIREBASE_APP_ID=
EOF
read -rp "   Press Enter once frontend/.env.local is filled in with the DEV project's values... " _

# --- 6. Deploy Firestore rules/indexes to the dev project ---------------------
bold "6. Deploying Firestore rules + indexes to $FIREBASE_DEV_PROJECT_ID"
firebase deploy --only firestore:rules,firestore:indexes --project "$FIREBASE_DEV_PROJECT_ID" \
  && ok "Firestore rules deployed to dev" \
  || warn "Rules deploy failed — check the error above."

# --- 7. Generate a service account for the dev project's CI deploys ----------
bold "7. Service account for CI (development environment)"
echo "   The 'development' GitHub Actions workflow (.github/workflows/deploy-dev.yml)"
echo "   needs its own service account key, scoped to THIS project only:"
echo "     1. https://console.firebase.google.com/project/$FIREBASE_DEV_PROJECT_ID/settings/serviceaccounts/adminsdk"
echo "     2. Generate new private key -> downloads a JSON file."
echo "     3. In IAM & Admin -> IAM for this project, give that service account the"
echo "        'Firebase Admin' role (covers Hosting + Firestore rules/indexes deploy)."
echo "   Never commit this file."
read -rp "   Press Enter once you've generated the key and granted the role... " _

# --- 8. Set GitHub Environment secrets for "development" ---------------------
bold "8. GitHub 'development' environment secrets"
if command -v gh >/dev/null 2>&1 && git remote get-url origin >/dev/null 2>&1; then
  echo "   Creating/using a GitHub Environment named 'development' and setting its secrets"
  echo "   from frontend/.env.local. You'll be prompted to paste the service account JSON."
  if [ -f frontend/.env.local ]; then
    set -a
    # shellcheck disable=SC1091
    source frontend/.env.local
    set +a
    for var in VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID \
               VITE_FIREBASE_STORAGE_BUCKET VITE_FIREBASE_MESSAGING_SENDER_ID VITE_FIREBASE_APP_ID; do
      val="${!var:-}"
      if [ -n "$val" ]; then
        gh secret set "$var" --env development -b"$val" && ok "Set development secret $var" || warn "Failed to set $var"
      else
        warn "$var is empty in frontend/.env.local — set it manually as a 'development' environment secret."
      fi
    done
  fi
  read -rp "   Paste the path to the downloaded service account JSON file, then press Enter: " SA_PATH
  if [ -n "${SA_PATH:-}" ] && [ -f "$SA_PATH" ]; then
    gh secret set FIREBASE_SERVICE_ACCOUNT --env development < "$SA_PATH" \
      && ok "Set development secret FIREBASE_SERVICE_ACCOUNT" \
      || warn "Failed to set FIREBASE_SERVICE_ACCOUNT — set it manually in GitHub -> Settings -> Environments -> development."
  else
    warn "Skipped — set FIREBASE_SERVICE_ACCOUNT manually in GitHub -> Settings -> Environments -> development."
  fi
else
  warn "No 'gh' CLI or git remote — set these manually: GitHub repo -> Settings -> Environments -> New environment 'development',"
  warn "then add secrets VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET,"
  warn "VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID, and FIREBASE_SERVICE_ACCOUNT — same 6+1 values, dev project's own."
fi

bold "9. One more thing — the 'develop' branch"
echo "   .github/workflows/deploy-dev.yml only triggers on pushes to a 'develop' branch."
echo "   If you don't have one yet:"
echo "     git checkout -b develop"
echo "     git push -u origin develop"
echo "   From then on: push feature work to 'develop' to test live against the dev project,"
echo "   merge to 'main' when it's ready for real family data."

bold "Done"
echo "Local dev (npm run dev) now points at $FIREBASE_DEV_PROJECT_ID via frontend/.env.local."
echo "Production (home-hub-family) and its data are untouched by any of this."
