import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  doc, getDoc, setDoc, collection, getDocs, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from './AuthContext.jsx'
import { setFamilyId as setDbFamilyId, subscribeToFamilyChanges } from '../db.js'
import { COLOR_PALETTE } from '../consts.js'

const FamilyContext = createContext(null)

// No ambiguous characters (0/O, 1/I) so codes are easy to read over text/phone.
const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateInviteCode() {
  let code = ''
  for (let i = 0; i < 6; i++) code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)]
  return code
}

async function nextAvailableColor(familyId) {
  const membersSnap = await getDocs(collection(db, 'families', familyId, 'members'))
  const used = new Set(membersSnap.docs.map((d) => d.data().color))
  return COLOR_PALETTE.find((c) => !used.has(c)) || COLOR_PALETTE[membersSnap.size % COLOR_PALETTE.length]
}

// Resolves which family (if any) the signed-in user belongs to, exposes the
// live family name/invite code, and provides createFamily/joinFamily for the
// FamilySetupPage. Once a familyId is known, it hands it to db.js
// (setFamilyId) and starts db.js's real-time Firestore listeners
// (subscribeToFamilyChanges) so every page's existing data hooks stay live.
export function FamilyProvider({ children }) {
  const { user } = useAuth()
  const [familyId, setFamilyIdState] = useState(undefined) // undefined = loading, null = no family yet
  const [familyName, setFamilyName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  useEffect(() => {
    if (user === undefined) return undefined // still resolving auth
    if (!user) {
      setFamilyIdState(null)
      return undefined
    }
    const userRef = doc(db, 'users', user.uid)
    const unsubscribe = onSnapshot(userRef, (snap) => {
      setFamilyIdState(snap.data()?.familyId || null)
    })
    return unsubscribe
  }, [user])

  useEffect(() => {
    if (!familyId) {
      setDbFamilyId(null)
      setFamilyName('')
      setInviteCode('')
      return undefined
    }
    setDbFamilyId(familyId)
    const familyRef = doc(db, 'families', familyId)
    const unsubFamily = onSnapshot(familyRef, (snap) => {
      const data = snap.data()
      setFamilyName(data?.name || '')
      setInviteCode(data?.inviteCode || '')
    })
    const unsubChanges = subscribeToFamilyChanges()
    return () => {
      unsubFamily()
      unsubChanges()
    }
  }, [familyId])

  const createFamily = useCallback(async (name) => {
    if (!user) throw new Error('Must be signed in to create a family')
    const familyRef = doc(collection(db, 'families'))
    const code = generateInviteCode()
    await setDoc(familyRef, {
      name: name.trim(),
      ownerUid: user.uid,
      inviteCode: code,
      createdAt: serverTimestamp(),
    })
    // A separate, minimal-info lookup doc: maps an invite code to nothing
    // but a familyId. This is what lets joinFamily() resolve a code with a
    // single get-by-id instead of a query across the whole `families`
    // collection — which matters because Firestore rules can't restrict
    // *which* documents a query is allowed to match, only whether matched
    // documents are readable. A broad query would've forced us to make every
    // family's name/owner readable by any signed-in user, even from
    // unrelated families. A direct get-by-id can be locked down to "you may
    // read this if you already know the exact code" (see firestore.rules).
    await setDoc(doc(db, 'inviteCodes', code), { familyId: familyRef.id })
    await setDoc(doc(db, 'families', familyRef.id, 'members', user.uid), {
      uid: user.uid,
      name: user.displayName || user.email,
      color: COLOR_PALETTE[0],
      role: 'owner',
      joinedAt: serverTimestamp(),
    })
    await setDoc(doc(db, 'users', user.uid), { uid: user.uid, email: user.email, familyId: familyRef.id }, { merge: true })
    return familyRef.id
  }, [user])

  const joinFamily = useCallback(async (rawCode) => {
    if (!user) throw new Error('Must be signed in to join a family')
    const code = rawCode.trim().toUpperCase()
    const lookup = await getDoc(doc(db, 'inviteCodes', code))
    if (!lookup.exists()) {
      throw new Error("That invite code doesn't match any family — double check with whoever sent it.")
    }
    const familyId = lookup.data().familyId
    const color = await nextAvailableColor(familyId)
    await setDoc(doc(db, 'families', familyId, 'members', user.uid), {
      uid: user.uid,
      name: user.displayName || user.email,
      color,
      role: 'member',
      joinedAt: serverTimestamp(),
    })
    await setDoc(doc(db, 'users', user.uid), { uid: user.uid, email: user.email, familyId }, { merge: true })
    return familyId
  }, [user])

  const value = {
    familyId,
    familyName,
    inviteCode,
    loading: familyId === undefined,
    hasFamily: Boolean(familyId),
    createFamily,
    joinFamily,
  }

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
}

export function useFamily() {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamily must be used within a FamilyProvider')
  return ctx
}
