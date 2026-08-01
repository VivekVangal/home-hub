import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as appMock from './mocks/appMock.js'
import * as firestoreMock from './mocks/firestoreMock.js'
import * as authMock from './mocks/authMock.js'
import * as functionsMock from './mocks/functionsMock.js'

// The whole app talks to Firebase (Auth + Firestore). None of that is
// reachable in tests (no real project, no emulator, no network in this
// sandbox), so every test run substitutes the in-memory fakes in
// src/test/mocks/ for the real SDK. db.js, firebase.js, AuthContext, and
// FamilyContext all import from 'firebase/*' normally — they have no idea
// they're talking to a fake.
vi.mock('firebase/app', () => appMock)
vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('firebase/auth', () => authMock)
vi.mock('firebase/functions', () => functionsMock)

// jsdom doesn't implement matchMedia at all. Defaults to "doesn't match"
// (desktop width) — tests that need to simulate a mobile viewport
// (useIsMobile, see hooks/useIsMobile.js) override window.matchMedia
// themselves for that one test, same pattern already used for
// window.location in SettingsPage.test.jsx.
window.matchMedia = window.matchMedia || function matchMedia(query) {
  return {
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

// Every test starts from a clean slate: no leftover DOM, no leftover
// localStorage, and fresh (empty) fake Firestore/Auth state.
afterEach(() => {
  cleanup()
  window.localStorage.clear()
  firestoreMock.resetFirestoreMock()
  authMock.resetAuthMock()
  functionsMock.resetFunctionsMock()
})
