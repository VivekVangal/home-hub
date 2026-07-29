# Open Tasks / Improvements

Running list of known open items — not household tasks (those live in the app's own Tasks page), this is for the project itself. Check items off / delete them here as they're resolved; ask me to add new ones as they come up.

## Open

- [ ] **Confirm CI is green end-to-end after the dev/prod split.** Push to `develop` and to `main` at least once and confirm both `deploy-dev.yml` and `deploy-prod.yml` complete successfully (install → test → build → hosting deploy → Firestore rules deploy).
- [ ] **Run `scripts/setup-dev-env.sh` fully**, including generating the dev project's own service account and setting the `development` GitHub Environment secrets (`FIREBASE_SERVICE_ACCOUNT` + the 6 `VITE_FIREBASE_*` values) — confirm `home-hub-family-dev.web.app` loads and signs in correctly.
- [ ] **`scripts/setup.sh` idempotency bug**: step 3 (Firebase project creation) `exit 1`s if the project already exists instead of soft-failing like the other steps. Low priority since setup is basically done, but worth a small fix so re-running the script doesn't hard-fail.
- [ ] **Route/location suggestions for training** — still needs your general area (town/zip) to suggest real routes; not started.
- [ ] **Make the training plan dynamic** — recalculate upcoming weeks based on runs actually logged (skipped/hard weeks slow the ramp, good weeks nudge back toward stretch pace), instead of a static pre-generated schedule.
- [ ] **Verify the training-plan feature on the dev site** — form-driven generator (any race/distance/goal, not just Baystate), private per-person (own Firestore rule + hidden from others' Combined calendar view). Committed to `develop`, not yet pushed/tested live.
- [ ] **Trainer access to a training plan** — deferred, not decided yet: import-only (paste/upload a coach's plan, no new access model), shared read, or shared edit. In tension with the self-only privacy rule just added on training profiles, worth deciding deliberately rather than defaulting.
- [ ] **Strava integration — code complete, blocked on manual setup.** Session done/skipped auto-matches to real Strava runs (distance/time/pace) via two Cloud Functions (`functions/`) and a Connect/Sync flow on the Training page. Chosen over Garmin's API (no self-service personal-use tier, business-only Connect Developer Program) and the unofficial `python-garminconnect` client. Built for Vivek's own account first — only he can connect for now, and it's dev-only (Strava allows one callback domain per app). To go live, still needed: (1) upgrade `home-hub-family-dev` to the Blaze plan, (2) register a Strava API app at strava.com/settings/api with callback domain `home-hub-family-dev.web.app`, (3) add the `VITE_STRAVA_CLIENT_ID` GitHub secret to the `development` Environment, (4) `firebase functions:secrets:set STRAVA_CLIENT_SECRET --project home-hub-family-dev`, (5) confirm the CI service account has `roles/cloudfunctions.admin` + `roles/iam.serviceAccountUser` in GCP IAM. Promoting to `main`/production later needs a second Strava app (or a domain swap) since Strava only allows one callback domain per app.
- [ ] **Upgrade pace-prediction formula** — currently uses Riegel (single race result -> equivalent time at another distance). Jack Daniels' VDOT formula would be a natural upgrade: same one-race input, but produces distinct easy/tempo/threshold/interval paces instead of one blended "stretch pace." Critical Velocity/Speed model is an option if two or more recent time trials get logged (more accurate, needs richer input).
- [ ] **Chat-driven app assistant** (natural language → add/edit events, tasks, groceries) — scoping got interrupted earlier. Needs a decision on scope (full control vs. training-plan-only vs. read-only Q&A), which AI provider (Claude API + a new Firebase Cloud Function to hold the key, vs. Gemini via Firebase AI Logic client-side), and who can use it (just you vs. whole family). Cloud Functions require the Blaze plan.

## Recently resolved

- [x] Calendar Day view alongside the existing Week view (click a day header, or the Day/Week toggle, to switch)
- [x] Dev/prod Firebase environment split (separate projects, separate CI pipelines, separate secrets)
- [x] Firestore deploy 403 (service account needed `roles/firebase.admin`)
- [x] Blank page in production (`auth/invalid-api-key` — GitHub secret had a bad/missing value)
- [x] CI Node version bumped 20 → 24
- [x] `docs/ARCHITECTURE.md` + architecture diagram committed
