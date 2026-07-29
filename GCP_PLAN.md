# Home Hub — GCP / Firebase Migration Plan

Status: **implemented.** Everything described below has been built — `db.js` is Firestore-backed, Auth + family-grouping screens exist, security rules are written. This doc is kept as the design rationale; see the main [`README.md`](./README.md) for the actual setup steps (creating the Firebase project, env vars, deploying).

## Why this exists

Today, Home Hub works but is single-device: everything lives in browser localStorage, and there's no concept of "who is logged in." You asked for real accounts and family grouping — multiple users get added to a family, the calendar/tasks/groceries are scoped to that family, and each family member can view either their own items or everything combined. That requires real auth and a real backend, which means Firebase, same as `baby-blog`.

## Repository setup (mirroring baby-blog)

`baby-blog`'s repo root looks like this:

```
baby-blog/
├── .github/workflows/deploy.yml   # CI: build + deploy to Firebase Hosting on push to main
├── frontend/                      # React (Vite) app
├── firebase.json                  # Hosting + Firestore + Storage config
├── firestore.rules
├── firestore.indexes.json
├── storage.rules                  # (not needed for Home Hub — no photo uploads)
├── cors.json                      # (not needed for Home Hub)
└── .firebaserc                    # points at the Firebase project id
```

`home-hub` already has the `frontend/` half of this (Vite + React, same conventions: `db.js` as the data-access layer, `pages/`, `components/`, `hooks/`). What's missing, and what this plan adds when we execute it:

- `firebase.json` — Hosting config (serve `frontend/dist`, SPA rewrite to `index.html`) + Firestore rules/indexes reference. No Storage block needed (no image uploads in this app).
- `firestore.rules` — see the sketch below.
- `firestore.indexes.json` — composite indexes for the queries described below.
- `.firebaserc` — `{ "projects": { "default": "<your-new-project-id>" } }`.
- `.github/workflows/deploy.yml` — same shape as baby-blog's: checkout → `npm ci` → `npm run build` (with `VITE_FIREBASE_*` secrets injected) → `FirebaseExtended/action-hosting-deploy`.
- `frontend/src/firebase.js` — SDK init, exporting `auth` and `db` (Firestore).

## Auth model

You asked for "a proper authenticator setup," not the passphrase-gate pattern baby-blog uses. Plan:

- **Firebase Authentication**, email/password to start (Google sign-in is a one-line addition later if you want it).
- Each family member creates their own account — a real identity, not a shared household password.
- A signed-in user with no family yet sees a "Create a family" / "Join a family" screen.

### Family creation & joining

```
users/{uid}                     — { uid, email, displayName, familyId }
families/{familyId}             — { name, ownerUid, inviteCode, createdAt }
families/{familyId}/members/{uid} — { uid, displayName, color, role, joinedAt }
```

- Creating a family generates a short `inviteCode` (e.g. 6 characters) stored on the family doc.
- Joining a family: user enters the invite code, client looks up the family by code, writes a `members/{uid}` doc and sets `users/{uid}.familyId`.
- `families/{familyId}/members` **replaces** today's localStorage `people` collection — same shape (`name`, `color`), just keyed by real `uid` instead of a random local id, and managed via signup/join instead of the Settings page's "add person" form. The Settings page still exists for renaming/recoloring yourself; you just can't add a person who hasn't signed up.

## Data model (Firestore)

Everything currently scoped globally (all of localStorage) becomes scoped to a family:

```
families/{familyId}/events/{eventId}      — same shape as today: title, date, startTime, endTime, owner, notes, createdAt
families/{familyId}/tasks/{taskId}        — same shape: type, title, category, dueDate, owner, recurrence, done, notes, createdAt
families/{familyId}/groceries/{itemId}    — same shape: name, quantity, category, checked, addedBy, weekStart, createdAt
```

`owner` (and `addedBy`) keep the exact same meaning they have today: either a specific member's `uid`, or the synthetic `"all"` value for shared/combined items. **No change to the app's mental model** — just where the data physically lives.

### Individual vs. combined views

This is already how `CalendarPage` and `TasksPage` work today (client-side filtering by `viewAs`), and it carries over unchanged:

- **Combined**: read all documents in `families/{familyId}/events` etc.
- **Individual (a specific member)**: filter to `owner == thatUid OR owner == "all"`.

The only thing that changes is *where* that data comes from (Firestore query instead of localStorage), not the filtering logic itself — `CalendarPage.jsx` and `TasksPage.jsx` won't need meaningful changes.

### Real-time sync (an upgrade over baby-blog's pattern)

baby-blog re-fetches on every page load. For Home Hub, since two people are actively coordinating a shared calendar, it's worth using Firestore's `onSnapshot` listeners instead of one-time `getDocs` — changes made on your wife's phone show up on your laptop within a second or two, no refresh needed. This is a small change in `db.js`: subscribe in `useLiveData`/`usePeople`-style hooks instead of fetch-once-and-poll-on-a-custom-event.

## Security rules (sketch)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function isMember(familyId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid));
    }

    match /users/{uid} {
      allow read, write: if isSignedIn() && request.auth.uid == uid;
    }

    match /families/{familyId} {
      allow read: if isMember(familyId);
      allow create: if isSignedIn(); // creating a new family
      allow update: if isMember(familyId);
    }

    match /families/{familyId}/members/{memberId} {
      allow read: if isMember(familyId);
      allow write: if isSignedIn() && request.auth.uid == memberId; // join / edit self
    }

    match /families/{familyId}/{collection}/{docId}
        where collection in ['events', 'tasks', 'groceries'] {
      allow read, write: if isMember(familyId);
    }
  }
}
```

(Firestore rules don't actually support a `where ... in [...]` shorthand across match blocks — that line is illustrative; the real rules file will have one explicit `match` block per collection, all with the same `isMember(familyId)` check.)

## Migration steps (when you're ready to execute)

1. **Create the Firebase project** (new project, per your earlier answer — not reusing `baby-vg`). Enable Firestore and Authentication (Email/Password provider) in the console.
2. `npm install firebase` in `frontend/`.
3. Add `frontend/src/firebase.js` — SDK init exporting `auth` and `db`, same pattern as baby-blog's `firebase.js`.
4. Build the auth screens: `SignInPage`, `SignUpPage`, `CreateOrJoinFamilyPage` — gate the whole app behind "signed in AND has a familyId," similar to how baby-blog's `App.jsx` gates on `useViewerAuth().authed`.
5. Add a `FamilyContext` (React context) that holds the current `familyId` and member list, replacing the current standalone `usePeople()` localStorage read.
6. Rewrite `db.js` function bodies (not signatures — `getEvents`, `addEvent`, `completeTask`, etc. keep the same names and return shapes) to hit `families/{familyId}/...` Firestore collections instead of localStorage. Every page (`CalendarPage`, `TasksPage`, `GroceryPage`, `HomePage`, `SettingsPage`) keeps working with minimal changes since they only ever talk to `db.js`, never to localStorage directly.
7. Add `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.firebaserc` at the repo root.
8. Add `.github/workflows/deploy.yml`, copied from baby-blog with the project id and `VITE_FIREBASE_*` secrets swapped in.
9. `firebase deploy` once manually to confirm it works, then let CI take over on future pushes to `main`.

## What you'll need to do yourself

I don't have GCP credentials or general internet access in this sandbox, so I can't create the Firebase project, enable APIs, or run `firebase deploy` for you. When you're ready:

- Create the project at https://console.firebase.google.com
- Enable Firestore (production mode) and Authentication → Email/Password
- Run `firebase login` and `firebase init` locally (or hand me the project id and I'll write every config file for you to deploy)
- Add the GitHub Actions secrets (`FIREBASE_SERVICE_ACCOUNT`, `VITE_FIREBASE_*`)

Happy to write all the code in steps 2–8 whenever you say go — this doc is just the map so we build it once, correctly, instead of iterating live against a real database.

## Not covered here (future, separate plan)

- **Garmin Connect integration** for the half-marathon training plan — same story as Firebase: needs API credentials and network access I don't have in this sandbox. Once the training plan feature is built, its own data-source plan (manual entry vs. Garmin OAuth) can follow this same "plan doc first" pattern.
- **Push notifications** (e.g. "grocery list not started this week") — possible via Firebase Cloud Messaging once the Firebase migration above is done, not before.
