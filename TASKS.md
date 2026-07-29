# Open Tasks / Improvements

Running list of known open items — not household tasks (those live in the app's own Tasks page), this is for the project itself. Check items off / delete them here as they're resolved; ask me to add new ones as they come up.

## Open

- [ ] **Confirm CI is green end-to-end after the dev/prod split.** Push to `develop` and to `main` at least once and confirm both `deploy-dev.yml` and `deploy-prod.yml` complete successfully (install → test → build → hosting deploy → Firestore rules deploy).
- [ ] **Run `scripts/setup-dev-env.sh` fully**, including generating the dev project's own service account and setting the `development` GitHub Environment secrets (`FIREBASE_SERVICE_ACCOUNT` + the 6 `VITE_FIREBASE_*` values) — confirm `home-hub-family-dev.web.app` loads and signs in correctly.
- [ ] **`scripts/setup.sh` idempotency bug**: step 3 (Firebase project creation) `exit 1`s if the project already exists instead of soft-failing like the other steps. Low priority since setup is basically done, but worth a small fix so re-running the script doesn't hard-fail.
- [ ] **Half-marathon training plan** (`HALF_MARATHON_PLAN.md`) — plan doc is written; still need answers on: your general location (for route suggestions), preferred training days, injury history, strength-training equipment access, and how firm the Oct 18 race date is. Once answered, generate the actual 12-week calendar events into Firestore.
- [ ] **Make the training plan dynamic** — recalculate upcoming weeks based on runs actually logged (skipped/hard weeks slow the ramp, good weeks nudge back toward stretch pace), instead of a static pre-generated schedule.
- [ ] **Chat-driven app assistant** (natural language → add/edit events, tasks, groceries) — scoping got interrupted earlier. Needs a decision on scope (full control vs. training-plan-only vs. read-only Q&A), which AI provider (Claude API + a new Firebase Cloud Function to hold the key, vs. Gemini via Firebase AI Logic client-side), and who can use it (just you vs. whole family). Cloud Functions require the Blaze plan.

## Recently resolved

- [x] Dev/prod Firebase environment split (separate projects, separate CI pipelines, separate secrets)
- [x] Firestore deploy 403 (service account needed `roles/firebase.admin`)
- [x] Blank page in production (`auth/invalid-api-key` — GitHub secret had a bad/missing value)
- [x] CI Node version bumped 20 → 24
- [x] `docs/ARCHITECTURE.md` + architecture diagram committed
