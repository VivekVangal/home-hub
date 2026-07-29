# Home Hub

A shared household app: daily/weekly calendar, a weekly grocery planner that feeds the dashboard, and a tasks list for home maintenance + general to-dos. Real accounts, real family grouping — each family member signs in themselves and sees their own calendar or the combined household view.

Built with React + Vite + Firebase (Auth + Firestore), structured the same way as `baby-blog`.

## What's in it

- **Sign in / Sign up** — email+password or Google. Every family member has their own account, not a shared household login.
- **Create or join a family** — the first person creates a family and gets a 6-character invite code; everyone else signs up and enters that code to join.
- **Dashboard** (`/`) — today's schedule, this week's remaining groceries, and overdue/upcoming tasks, all in one view.
- **Calendar** (`/calendar`) — week view, add/edit/delete events, assign each event to a family member or "Everyone." A **Combined / individual** filter lets you view the whole family's calendar or just one person's (their own events plus anything shared).
- **Groceries** (`/groceries`) — a list scoped to the current week (Mon–Sun). Adding/checking off items here is what shows up on the dashboard.
- **Tasks** (`/tasks`) — two tabs: **Maintenance** (recurring upkeep like HVAC filters, gutter cleaning, with due dates and repeat intervals) and **To-dos** (anything else). Completing a recurring maintenance task automatically creates the next occurrence. Same Combined/individual filter as the calendar.
- **Settings** (`/settings`) — your family's invite code (to bring in more members), plus rename/recolor/remove for existing members.
- **Real-time sync** — changes made on one device show up on another within a second or two (Firestore listeners), not just on next page load.

## Firebase setup (do this once)

I don't have GCP credentials or general internet access in the sandbox this was built in, so I couldn't create the project or run these steps myself. Here's exactly what to do:

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

At this point `npm run dev` inside `frontend/` gives you a fully working, real, multi-device app.

## Run it locally

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, sign up, create a family, and share the invite code with whoever else should join (they sign up separately and enter the code).

## Publishing it for real (Firebase Hosting + CI/CD)

1. **Create a GitHub repo** for this project and push it:
   ```bash
   cd home-hub
   git init
   git add .
   git commit -m "Home Hub: Firebase Auth + Firestore integration"
   git branch -M main
   git remote add origin https://github.com/<you>/home-hub.git
   git push -u origin main
   ```
2. **Generate a Firebase service account key** for CI: Firebase Console → Project Settings → Service accounts → Generate new private key. This downloads a JSON file — **never commit it**.
3. **Add GitHub repo secrets** (repo Settings → Secrets and variables → Actions → New repository secret):
   - `FIREBASE_SERVICE_ACCOUNT` — paste the entire contents of the JSON key file from step 2.
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` — same 6 values from `.env.local`.
4. **Push to `main`.** `.github/workflows/deploy.yml` runs the tests, builds, deploys the frontend to Firebase Hosting, and deploys `firestore.rules`/`firestore.indexes.json` — every push to `main` from then on auto-deploys.
5. Your live URL will be `https://<your-project-id>.web.app`.

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
```

`owner` (and `addedBy`) is either a specific member's `uid` or the synthetic `"all"` value for anything shared with the whole family — that's what the Combined/individual filter checks. Security rules (`firestore.rules`) only let a signed-in user read/write a family's data if they have a `members/{their-uid}` doc in that family.

`firestore.indexes.json` is intentionally empty — every query here uses either a single field or multiple equality (`==`) filters, which Firestore serves from its automatic indexes; sorting happens client-side in `db.js` instead of via `orderBy`, so no composite indexes are needed.

See **[`GCP_PLAN.md`](./GCP_PLAN.md)** for the full design rationale, including the security rules sketch this was built from and what's intentionally deferred (Cloud Functions for invite-code lookups, push notifications, etc.).

## Customizing

- Family members (names, colors): the **Settings page** in the app. New members join via the invite code shown there — there's no "add a person" form anymore, since everyone has their own login.
- Maintenance categories (HVAC, Plumbing, etc.): `MAINTENANCE_CATEGORIES` in `frontend/src/consts.js`.
- Grocery categories: `GROCERY_CATEGORIES` in `frontend/src/db.js`.
- Color palette assigned to new members as they join: `COLOR_PALETTE` in `frontend/src/consts.js`.
