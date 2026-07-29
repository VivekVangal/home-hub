import { createElement } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '../firebase.js'
import { setFamilyId } from '../db.js'
import { AuthProvider } from '../context/AuthContext.jsx'
import { FamilyProvider } from '../context/FamilyContext.jsx'

export const TEST_FAMILY_ID = 'test-family'

export const DEFAULT_TEST_MEMBERS = [
  { id: 'person-1', name: 'Person 1', color: '#3b82f6' },
  { id: 'person-2', name: 'Person 2', color: '#ec4899' },
]

// Most component/page tests just need a family with a couple of members to
// exist before they render (db.js's getPeople() returns [] for a family
// with no members, same as it would for a brand new real family). This
// bypasses rendering the actual sign-up/create-family flow and seeds the
// same Firestore shape that FamilyContext.createFamily/joinFamily produce.
export async function seedTestFamily(members = DEFAULT_TEST_MEMBERS) {
  setFamilyId(TEST_FAMILY_ID)
  for (const m of members) {
    // eslint-disable-next-line no-await-in-loop
    await setDoc(doc(db, 'families', TEST_FAMILY_ID, 'members', m.id), {
      uid: m.id, name: m.name, color: m.color, role: 'member', joinedAt: null,
    })
  }
}

// For tests that exercise AuthContext/FamilyContext directly (SettingsPage,
// anything reading `useAuth()`/`useFamily()`): signs a fake user in via the
// mocked Firebase Auth, then seeds the same families/{id}, members/{uid},
// and users/{uid} docs the real createFamily() flow writes. Call this
// BEFORE rendering — AuthProvider/FamilyProvider pick up existing state
// immediately on mount (the mocks fire onAuthStateChanged/onSnapshot with
// current state right away, same as real Firebase).
export async function setupSignedInFamily({
  email = 'vivek@example.com',
  password = 'password123',
  familyName = 'Test Family',
  inviteCode = 'TEST01',
  members = DEFAULT_TEST_MEMBERS,
} = {}) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  const familyId = TEST_FAMILY_ID

  await setDoc(doc(db, 'families', familyId), {
    name: familyName, ownerUid: user.uid, inviteCode, createdAt: null,
  })
  for (const m of members) {
    // eslint-disable-next-line no-await-in-loop
    await setDoc(doc(db, 'families', familyId, 'members', m.id), {
      uid: m.id, name: m.name, color: m.color, role: m.id === user.uid ? 'owner' : 'member', joinedAt: null,
    })
  }
  await setDoc(doc(db, 'users', user.uid), { uid: user.uid, email, familyId })

  return { user, familyId }
}

// Adds (or overwrites) a single member doc in a family — handy for adding
// the currently signed-in test user as a member using their real uid, since
// setupSignedInFamily's `members` option can't know that uid in advance.
export async function seedMember(familyId, id, data) {
  await setDoc(doc(db, 'families', familyId, 'members', id), {
    uid: id, name: data.name, color: data.color, role: data.role || 'member', joinedAt: null,
  })
}

// Wraps a component with the real AuthProvider + FamilyProvider (backed by
// the mocked Firebase SDK) so components that call useAuth()/useFamily()
// work in tests exactly like they do in the app. Written with
// createElement (not JSX) so this helper can stay a plain .js file.
export function AllProviders({ children }) {
  return createElement(AuthProvider, null, createElement(FamilyProvider, null, children))
}
