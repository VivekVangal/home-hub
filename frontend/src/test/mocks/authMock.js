// A minimal in-memory fake of the 'firebase/auth' modular SDK, covering just
// what AuthContext.jsx uses: email/password sign up & sign in, Google
// sign-in (simulated), sign out, profile updates, and the auth-state
// subscription. See firestoreMock.js for why this exists instead of the
// Firebase emulator.

let currentUser = null
let listeners = new Set()
let usersByEmail = new Map()
let uidCounter = 0

export function resetAuthMock() {
  currentUser = null
  listeners = new Set()
  usersByEmail = new Map()
  uidCounter = 0
}

function notifyListeners() {
  listeners.forEach((cb) => cb(currentUser))
}

export function getAuth() {
  return { __type: 'auth' }
}

export class GoogleAuthProvider {}

export function onAuthStateChanged(auth, cb) {
  listeners.add(cb)
  cb(currentUser)
  return () => listeners.delete(cb)
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  if (usersByEmail.has(email)) {
    const err = new Error('That email is already registered.')
    err.code = 'auth/email-already-in-use'
    throw err
  }
  if (!password || password.length < 6) {
    const err = new Error('Password should be at least 6 characters.')
    err.code = 'auth/weak-password'
    throw err
  }
  uidCounter += 1
  const record = { uid: `uid-${uidCounter}`, email, password, displayName: null }
  usersByEmail.set(email, record)
  currentUser = { uid: record.uid, email: record.email, displayName: record.displayName }
  notifyListeners()
  return { user: currentUser }
}

export async function signInWithEmailAndPassword(auth, email, password) {
  const record = usersByEmail.get(email)
  if (!record || record.password !== password) {
    const err = new Error('Incorrect email or password.')
    err.code = 'auth/invalid-credential'
    throw err
  }
  currentUser = { uid: record.uid, email: record.email, displayName: record.displayName }
  notifyListeners()
  return { user: currentUser }
}

// Simulates a Google account. Reuses the same fake account on repeat calls
// within a test so "sign in with Google" is idempotent for the same user.
export async function signInWithPopup() {
  const email = 'google-user@example.com'
  let record = usersByEmail.get(email)
  if (!record) {
    uidCounter += 1
    record = { uid: `uid-${uidCounter}`, email, password: null, displayName: 'Google User' }
    usersByEmail.set(email, record)
  }
  currentUser = { uid: record.uid, email: record.email, displayName: record.displayName }
  notifyListeners()
  return { user: currentUser }
}

export async function signOut() {
  currentUser = null
  notifyListeners()
}

export async function updateProfile(user, data) {
  if (currentUser && currentUser.uid === user.uid) {
    currentUser = { ...currentUser, ...data }
  }
  const record = [...usersByEmail.values()].find((u) => u.uid === user.uid)
  if (record) Object.assign(record, data)
  notifyListeners()
}
