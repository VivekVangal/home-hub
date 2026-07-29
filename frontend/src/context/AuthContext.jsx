import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase.js'

const AuthContext = createContext(null)

// Wraps Firebase Auth. `user` is `undefined` while the initial auth check is
// in flight, `null` once we know for sure nobody's signed in, or the
// Firebase User object once they are — App.jsx uses this three-state value
// to decide what to render (loading / sign-in screen / the app).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u))
    return unsubscribe
  }, [])

  const signUp = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) {
      await updateProfile(cred.user, { displayName })
    }
    return cred.user
  }

  const signIn = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  }

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider)
    return cred.user
  }

  const signOut = () => firebaseSignOut(auth)

  const value = {
    user,
    loading: user === undefined,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
