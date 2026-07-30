# Home Hub

A shared household app: daily/weekly calendar, a weekly grocery planner that feeds the dashboard, and a tasks list for home maintenance + general to-dos. Real accounts, real family grouping — each family member signs in themselves and sees their own calendar or the combined household view.

Built with React + Vite + Firebase (Auth + Firestore), structured the same way as `baby-blog`.

## What's in it

- **Sign in / Sign up** — email+password or Google. Every family member has their own account, not a shared household login.
- **Create or join a family** — the first person creates a family and gets a 6-character invite code; everyone else signs up and enters that code to join.
- **Dashboard** (`/`) — today's schedule, this week's remaining groceries, and overdue/upcoming tasks, all in one view.
- **Calendar** (`/calendar`) — week or day view (toggle, or click a day header to jump into that day), add/edit/delete events, assign each event to a family member or "Everyone." A **Combined / individual** filter lets you view the whole family's calendar or just one person's (their own events plus anything shared).
- **Groceries** (`/groceries`) — a list scoped to the current week (Mon–Sun). Adding/checking off items here is what shows up on the dashboard.
- **Tasks** (`/tasks`) — two tabs: **Maintenance** (recurring upkeep like HVAC filters, gutter cleaning, with due dates and repeat intervals) and **To-dos** (anything else). Completing a recurring maintenance task automatically creates the next occurrence. Same Combined/individual filter as the calendar.
- **Settings** (`/settings`) — your family's invite code (to bring in more members), plus rename/recolor/remove for existing members.
- **Training** (`/training`) — a form-driven training-plan generator (any race, distance, and goal time — not hardcoded to one race), which appends sessions to your calendar. Private by design: your training plan and prep to-dos are hidden from everyone else's Combined view, and your training profile (goals, injury notes) is locked to your own account at the Firestore rules level. Optionally connect **Strava** or **Terra** (Garmin, Apple Health, Fitbit, Oura, and others) to auto-fill actual distance/time/pace on completed sessions — see "Fitness data sync" below for setup.
- **Ideas** (`/ideas`) — a lightweight backlog for product ideas and home-automation ideas you want to track and eventually build.
- **Real-time sync** — changes made on one device show up on another within a second or two (Firestore listeners), not just on next page load.

## Setup: the fast way

I don't have GCP credentials or general internet access in the sandbox this was built in, so I couldn't create the GitHub repo or Firebase project myself. `scripts/setup.sh` automates as much of it as a script actually can:

```bash
cd home-hub
chmod +x scripts/setup.sh
./scripts/setup.sh
```

It creates the GitHub repo and pushes (via `gh`), creates the Firebase project, creates the Firestore database, registers the web app, wires up GitHub Actions auto-deploy (via `firebase init hosting:github`), and sets the GitHub secrets — all with the defaults `vivekvangal/home-hub` (public repo) and `home-hub-family` (Firebase project id). Override either with env vars, e.g. `FIREBASE_PROJECT_ID=my-id ./scripts/setup.sh`.

**One thing it can't do:** there's no CLI for enabling Firebase Auth sign-in providers. The script pauses and tells you to enable Email/Password and Google in the console, then waits for you to hit Enter before continuing. Every other step is either fully automatic or fails soft with fallback instructions printed if your `firebase-tools`/`gh` CLI versions behave differently than expected — I couldn't test this script against a real Firebase account, so treat step failures as "do this one step manually" rather than a sign the whole thing is broken.

Requires `git`, `node`/`npm` (installs `firebase-tools` itself if missing), and ideally the [GitHub CLI](https://cli.github.com) (`gh`) — without `gh` it'll print the manual repo-creation steps instead of automating them.

## Setup: the manual way

If you'd rather not run a script, or want to understand what it's doing:

1. **Create the project.** Go to https://console.firebase.google.com → Add project → name it whatever you want (e.g. `home-hub-family`) → you can skip Google Analytics.
2. **Enable Authentication.** In the console: Build → Authentication → Get started → enable **Email/Password**, and enable **Google** (add a support email when prompted).
3. **Enable Firestore.** Build → Firestore Database → Create database → start in **production mode** → pick a region close to you.
4. **Register a web app.** Project Settings (gear icon) → General → "Your apps" → Add app → Web (`</>`) → give it a nickname → you'll get a `firebaseConfig` object. Copy those 6 values.
5. **Set your local env vars.** Copy `frontend/.env.local.example` to `frontend/.env.local` and paste in the 6 values from step 4.
6. **Update `.firebaserc`.** Replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` at the repo root with your actual Firebase project ID (visible in Project Settings).
7. **Install the Firebase CLI and deploy rules once manually:**
   ```bash
   npm install -g firebase-tools
   firebase login
   cd home-hub
   firebase deploy --only firestore:rules,firestore:indexes
   ```
8. **Create the GitHub repo and push:**
   ```bash
   git remote add origin https://github.com/<you>/home-hub.git
   git push -u origin main
   ```
9. **Generate a Firebase service account key** for CI: Firebase Console → Project Settings → Service accounts → Generate new private key. This downloads a JSON file — **never commit it**.
10. **Add GitHub repo secrets** (repo Settings → Secrets and variables → Actions → New repository secret):
    - `FIREBASE_SERVICE_ACCOUNT` — paste the entire contents of the JSON key file from step 9.
    - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` — same 6 values from `.env.local`.
11. **Push to `main`.** `.github/workflows/deploy-prod.yml` runs the tests, builds, deploys the frontend to Firebase Hosting, and deploys `firestore.rules`/`firestore.indexes.json` — every push to `main` from then on auto-deploys to production. See "Environments" below for setting up the separate dev project/pipeline.

Either way, your live URL will be `https://<your-project-id>.web.app`.

## Environments — dev and production are separate Firebase projects

**Production** (`home-hub-family`) is what real family data lives in and what `https://home-hub-family.web.app` serves. **Development** (`home-hub-family-dev`) is a second, independent Firebase project — separate Auth users, separate Firestore, separate everything — that exists purely so local testing and in-progress features never touch real data.

Set it up once with:

```bash
cd home-hub
chmod +x scripts/setup-dev-env.sh
./scripts/setup-dev-env.sh
```

This creates the `home-hub-family-dev` project, walks you through enabling Auth providers on it, and sets up a `development` GitHub Environment with its own secrets. After that:

- **`frontend/.env.local`** (used by `npm run dev` locally) should always hold the **dev** project's config values — never production's.
- **Pushing to `develop`** deploys to the dev project via `.github/workflows/deploy-dev.yml`, giving you a live URL (`https://home-hub-family-dev.web.app`) to test against before anything reaches real users.
- **Pushing to `main`** deploys to production via `.github/workflows/deploy-prod.yml`, unchanged from before.
- **`.firebaserc`** has both project aliases (`dev`, `prod`) — e.g. `firebase deploy --project dev` from your terminal targets the dev project explicitly.

Regular deploys (hosting or Firestore rules/indexes) never delete Firestore documents on their own — if data ever seemed to disappear after a deploy, the likely cause was local testing running against the same project as production, which this split eliminates going forward.

## Fitness data sync (Strava + Terra)

Both are optional — the Training page works fine without either, just without auto-filled actual distance/time/pace. Both need the Blaze plan (Cloud Functions don't run on Spark).

**Strava** — good if it's just you:
1. Register an API app at https://www.strava.com/settings/api, with callback domain set to your Firebase Hosting domain (e.g. `home-hub-family-dev.web.app`).
2. Add `VITE_STRAVA_CLIENT_ID` as a GitHub Actions secret (repo secret, or the `development`/`production` Environment).
3. `firebase functions:secrets:set STRAVA_CLIENT_SECRET --project <your-project-id>`.
4. Deploy the functions (`firebase deploy --only functions`, or just push — CI does it). Strava only allows one callback domain per app, so dev and prod need separate Strava apps if you want both connected.

**Terra** — better if multiple people use different platforms (Garmin, Apple Health, Fitbit, Oura, Whoop, etc.):
1. Sign up at https://tryterra.co and get a `dev-id` + API key from the dashboard.
2. Set three Firebase Function secrets: `firebase functions:secrets:set TERRA_API_KEY --project <your-project-id>`, then the same for `TERRA_DEV_ID` and `TERRA_SIGNING_SECRET` (the signing secret comes from Terra's Destinations/Webhooks page — you'll generate it when adding a webhook destination in step 4).
3. Deploy the functions (`firebase deploy --only functions`, or push and let CI do it) — this creates the `terraWebhook` HTTPS endpoint.
4. In the Terra dashboard, add a Webhook destination pointing at your deployed `terraWebhook` function's URL (find it with `firebase functions:list` or in the Cloud Functions console after deploying).

No frontend env var is needed for Terra — unlike Strava's `client_id`, Terra's `dev-id` is only ever used server-side inside the Cloud Function.

## Run it locally

```bash
cd frontend
npm install
npm run dev
```

Make sure `frontend/.env.local` points at the **dev** Firebase project (see "Environments" above) before doing this — otherwise you're testing against real family data.

Open http://localhost:5173, sign up, create a family, and share the invite code with whoever else should join (they sign up separately and enter the code).

## Run the tests

```bash
cd frontend
npm install
npm test          # runs the full suite once
npm run test:watch   # re-runs on file changes while you work
```

Coverage:

- **`src/__tests__/dates.test.js`** — date utilities (week boundaries, formatting, past-due logic).
- **`src/__tests__/db.test.js`** — the Firestore-backed data layer (mocked — no real Firebase project needed to run tests): people/members, events, groceries, tasks, recurrence, and owner-reassignment-on-removal, all exercised against an in-memory fake Firestore.
- **`src/__tests__/context/`** — `AuthContext` (sign up/in, Google sign-in, sign out) and `FamilyContext` (create family generates an invite code, join family by code, invalid code errors) against mocked Firebase Auth/Firestore.
- **`src/__tests__/components/`** — `EventModal`, `TaskModal`, `WeekCalendar`, `GroceryAddForm` in isolation (form validation, submit payloads, owner-color fallback, click handlers).
- **`src/__tests__/pages/`** — `SettingsPage` (invite code display, rename/remove members), `CalendarPage`, `TasksPage`, `HomePage` as integration tests. `CalendarPage`/`TasksPage` verify the Combined/individual filter end to end.

> Note on verification: I wrote and statically checked all of this code (balanced brackets, every import resolves to a real export) by hand, but this sandbox has no internet access, so I was never able to run `npm install` and actually execute the test suite, `npm run dev`, or a real Firebase project myself. Everything here should work — the mocked tests exercise the exact same `db.js`/context code the real app uses — but you're the first to run it against an actual Firebase project. If anything breaks, send me the error and I'll fix it fast.

## How the data model works

Every family's data lives under `families/{familyId}/` in Firestore:

```
families/{familyId}                    — { name, ownerUid, inviteCode, createdAt }
families/{familyId}/members/{uid}      — { uid, name, color, role, joinedAt }
families/{familyId}/events/{eventId}   — { title, date, startTime, endTime, owner, notes, createdAt }
families/{familyId}/tasks/{taskId}     — { type, title, category, dueDate, owner, recurrence, done, notes, createdAt }
families/{familyId}/groceries/{itemId} — { name, quantity, category, checked, addedBy, weekStart, createdAt }
users/{uid}                            — { uid, email, familyId }  (maps a signed-in user to their family)
inviteCodes/{code}                     — { familyId }  (nothing else — see below)
```

`owner` (and `addedBy`) is either a specific member's `uid` or the synthetic `"all"` value for anything shared with the whole family — that's what the Combined/individual filter checks.

**Privacy: families can't see each other at all.** `firestore.rules` only lets a signed-in user read/write a family's data — including just the family's *name* — if they have a `members/{their-uid}` doc in that family. Nobody can browse or discover other families, even other Home Hub users you've never met.

The one wrinkle this creates: joining a family by invite code needs *some* way to look up a family from a code before you're a member of it — but a database query can't be restricted to "only if you already knew what you were looking for," only "can this signed-in user read documents matching this query" (Firestore rules see documents, not query intent). So instead of querying the `families` collection directly, `joinFamily()` looks up `inviteCodes/{code}` — a single get-by-exact-id, which the rules allow for any signed-in user (get, not list/query), because getting that specific document requires already knowing the 6-character code. That document holds nothing but a `familyId`; the real `families/{familyId}` doc — name, owner, everything else — stays members-only.

`firestore.indexes.json` is intentionally empty — every query here uses either a single field or multiple equality (`==`) filters, which Firestore serves from its automatic indexes; sorting happens client-side in `db.js` instead of via `orderBy`, so no composite indexes are needed.

See **[`GCP_PLAN.md`](./GCP_PLAN.md)** for the full design rationale, including the security rules sketch this was built from and what's intentionally deferred (Cloud Functions for invite-code lookups, push notifications, etc.). See **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** for a diagram of how the pieces connect, plus a cost breakdown of running this on Firebase.

## Customizing

- Family members (names, colors): the **Settings page** in the app. New members join via the invite code shown there — there's no "add a person" form anymore, since everyone has their own login.
- Maintenance categories (HVAC, Plumbing, etc.): `MAINTENANCE_CATEGORIES` in `frontend/src/consts.js`.
- Grocery categories: `GROCERY_CATEGORIES` in `frontend/src/db.js`.
- Color palette assigned to new members as they join: `COLOR_PALETTE` in `frontend/src/consts.js`.
