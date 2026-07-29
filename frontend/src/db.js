// ---------------------------------------------------------------------------
// Data layer — Firestore-backed, scoped per family.
//
// Every exported function keeps the exact name/signature it had in the
// localStorage-based version of this file (getEvents, addEvent, completeTask,
// getPeople, etc.), so every page and hook that calls into db.js is
// unaffected by this migration.
//
// How real-time sync works: every mutating function here dispatches the same
// 'homehub:change' CustomEvent the old localStorage version used to dispatch
// after every write, so local edits refresh the UI immediately regardless of
// context. On top of that, FamilyContext calls setFamilyId() once the
// signed-in user's family is known and then subscribeToFamilyChanges(),
// which opens Firestore onSnapshot listeners on every family-scoped
// collection — so changes made on a DIFFERENT device also dispatch
// 'homehub:change' here, close to instantly via Firestore's local cache.
// Either way, useLiveData() (unchanged) just listens for that event and
// refetches; it doesn't know or care that the data now comes from Firestore
// instead of localStorage.
// ---------------------------------------------------------------------------

import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { addDaysISO } from './utils/dates.js'

let currentFamilyId = null

export function setFamilyId(familyId) {
  currentFamilyId = familyId
}

export function getFamilyId() {
  return currentFamilyId
}

function requireFamilyId() {
  if (!currentFamilyId) throw new Error('No family selected yet')
  return currentFamilyId
}

function familyCollection(name) {
  return collection(db, 'families', requireFamilyId(), name)
}

function familyDoc(collectionName, id) {
  return doc(db, 'families', requireFamilyId(), collectionName, id)
}

function notifyChange(key) {
  window.dispatchEvent(new CustomEvent('homehub:change', { detail: { key } }))
}

const LISTENED_COLLECTIONS = ['members', 'events', 'groceries', 'tasks']

// Opens one onSnapshot listener per family-scoped collection. Returns an
// unsubscribe function that tears all of them down (called by FamilyContext
// when the family changes or the user signs out).
export function subscribeToFamilyChanges() {
  const familyId = requireFamilyId()
  const unsubs = LISTENED_COLLECTIONS.map((name) =>
    onSnapshot(
      collection(db, 'families', familyId, name),
      () => notifyChange(name),
      (err) => console.error(`homehub: "${name}" listener error`, err)
    )
  )
  return () => unsubs.forEach((unsub) => unsub())
}

// ============================ PEOPLE (family members) ========================
// Shape: { id (== Firebase Auth uid), name, color, role, joinedAt }
// Members are created by FamilyContext's createFamily/joinFamily (they map
// to real accounts), not by an arbitrary "add person" form — see
// SettingsPage.jsx and GCP_PLAN.md for why.

export async function getPeople() {
  if (!currentFamilyId) return []
  const snap = await getDocs(familyCollection('members'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(a.joinedAt) - toMillis(b.joinedAt))
}

function toMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  return 0
}

export async function updatePerson(id, data) {
  if (!currentFamilyId) return null
  const ref = familyDoc('members', id)
  const existing = await getDoc(ref)
  if (!existing.exists()) return null
  await updateDoc(ref, data)
  const updated = await getDoc(ref)
  notifyChange('members')
  return { id: updated.id, ...updated.data() }
}

// Removing a member reassigns anything that was theirs to "Everyone" rather
// than leaving dangling owner references pointing at someone no longer here.
export async function deletePerson(id) {
  if (!currentFamilyId) return
  const familyId = currentFamilyId
  const batch = writeBatch(db)
  batch.delete(doc(db, 'families', familyId, 'members', id))

  const [eventsSnap, tasksSnap, groceriesSnap] = await Promise.all([
    getDocs(query(collection(db, 'families', familyId, 'events'), where('owner', '==', id))),
    getDocs(query(collection(db, 'families', familyId, 'tasks'), where('owner', '==', id))),
    getDocs(query(collection(db, 'families', familyId, 'groceries'), where('addedBy', '==', id))),
  ])
  eventsSnap.forEach((d) => batch.update(d.ref, { owner: 'all' }))
  tasksSnap.forEach((d) => batch.update(d.ref, { owner: 'all' }))
  groceriesSnap.forEach((d) => batch.update(d.ref, { addedBy: 'all' }))

  await batch.commit()
  notifyChange('members')
  notifyChange('events')
  notifyChange('tasks')
  notifyChange('groceries')
}

// =========================== EVENTS (Calendar) =============================
// Shape: { id, title, date: 'YYYY-MM-DD', startTime, endTime, owner, notes, createdAt }

export async function getEvents() {
  if (!currentFamilyId) return []
  const snap = await getDocs(familyCollection('events'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')))
}

export async function addEvent(data) {
  requireFamilyId()
  const payload = { notes: '', startTime: '', endTime: '', createdAt: Date.now(), ...data }
  const ref = await addDoc(familyCollection('events'), payload)
  notifyChange('events')
  return { id: ref.id, ...payload }
}

export async function updateEvent(id, data) {
  if (!currentFamilyId) return null
  const ref = familyDoc('events', id)
  const existing = await getDoc(ref)
  if (!existing.exists()) return null
  await updateDoc(ref, data)
  notifyChange('events')
  return { id, ...existing.data(), ...data }
}

export async function deleteEvent(id) {
  if (!currentFamilyId) return
  await deleteDoc(familyDoc('events', id))
  notifyChange('events')
}

// ======================= GROCERIES (weekly planner) =========================
// Shape: { id, weekStart: 'YYYY-MM-DD' (Monday), name, quantity, category,
//          checked, addedBy, createdAt }

export const GROCERY_CATEGORIES = [
  'Produce', 'Dairy', 'Meat & Seafood', 'Pantry', 'Frozen', 'Bakery', 'Household', 'Other',
]

export async function getGroceryItems(weekStart) {
  if (!currentFamilyId) return []
  const snap = await getDocs(query(familyCollection('groceries'), where('weekStart', '==', weekStart)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function addGroceryItem(data) {
  requireFamilyId()
  const payload = {
    quantity: '', category: 'Other', checked: false, addedBy: 'all', createdAt: Date.now(), ...data,
  }
  const ref = await addDoc(familyCollection('groceries'), payload)
  notifyChange('groceries')
  return { id: ref.id, ...payload }
}

export async function updateGroceryItem(id, data) {
  if (!currentFamilyId) return null
  const ref = familyDoc('groceries', id)
  const existing = await getDoc(ref)
  if (!existing.exists()) return null
  await updateDoc(ref, data)
  notifyChange('groceries')
  return { id, ...existing.data(), ...data }
}

export async function deleteGroceryItem(id) {
  if (!currentFamilyId) return
  await deleteDoc(familyDoc('groceries', id))
  notifyChange('groceries')
}

export async function clearCheckedGroceryItems(weekStart) {
  if (!currentFamilyId) return
  const snap = await getDocs(query(
    familyCollection('groceries'),
    where('weekStart', '==', weekStart),
    where('checked', '==', true)
  ))
  const batch = writeBatch(db)
  snap.forEach((d) => batch.delete(d.ref))
  await batch.commit()
  notifyChange('groceries')
}

// ==================== TASKS (maintenance + general to-dos) ===================
// Shape: { id, title, type: 'maintenance'|'todo', category, dueDate, owner,
//          recurrence: 'none'|'weekly'|'monthly'|'quarterly'|'yearly', done, notes, createdAt }

const RECURRENCE_DAYS = { weekly: 7, monthly: 30, quarterly: 91, yearly: 365 }

export async function getTasks() {
  if (!currentFamilyId) return []
  const snap = await getDocs(familyCollection('tasks'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
}

export async function addTask(data) {
  requireFamilyId()
  const payload = {
    type: 'todo', category: '', dueDate: '', owner: 'all', recurrence: 'none',
    done: false, notes: '', createdAt: Date.now(), ...data,
  }
  const ref = await addDoc(familyCollection('tasks'), payload)
  notifyChange('tasks')
  return { id: ref.id, ...payload }
}

export async function updateTask(id, data) {
  if (!currentFamilyId) return null
  const ref = familyDoc('tasks', id)
  const existing = await getDoc(ref)
  if (!existing.exists()) return null
  await updateDoc(ref, data)
  notifyChange('tasks')
  return { id, ...existing.data(), ...data }
}

export async function deleteTask(id) {
  if (!currentFamilyId) return
  await deleteDoc(familyDoc('tasks', id))
  notifyChange('tasks')
}

// Marks a task done. If it recurs, spawns the next occurrence automatically
// (e.g. "Change HVAC filter" every 90 days keeps regenerating).
export async function completeTask(id) {
  if (!currentFamilyId) return null
  const ref = familyDoc('tasks', id)
  const existing = await getDoc(ref)
  if (!existing.exists()) return null
  const task = { id, ...existing.data() }

  await updateDoc(ref, { done: true, completedAt: Date.now() })

  if (task.recurrence && task.recurrence !== 'none' && task.dueDate) {
    const days = RECURRENCE_DAYS[task.recurrence] || 0
    const nextDue = addDaysISO(task.dueDate, days)
    const { id: _oldId, ...rest } = task
    await addDoc(familyCollection('tasks'), {
      ...rest,
      dueDate: nextDue,
      done: false,
      completedAt: null,
      createdAt: Date.now(),
    })
  }

  const updated = await getDoc(ref)
  notifyChange('tasks')
  return { id, ...updated.data() }
}
