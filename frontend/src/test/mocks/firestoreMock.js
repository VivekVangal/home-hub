// A minimal in-memory fake of the 'firebase/firestore' modular SDK — just
// enough of the API surface that db.js, FamilyContext, and their tests use
// (collection/doc/getDocs/getDoc/addDoc/setDoc/updateDoc/deleteDoc/query/
// where/onSnapshot/writeBatch/serverTimestamp). Docs are stored as plain
// objects in a Map keyed by full path string ("families/f1/members/u1").
//
// This lets the whole app's data layer be tested without a real Firebase
// project or the Firestore emulator (which needs Java + network access,
// neither available in the sandbox this was built in).

let store = new Map()
let listeners = new Set()
let autoIdCounter = 0

export function resetFirestoreMock() {
  store = new Map()
  listeners = new Set()
  autoIdCounter = 0
}

function genId() {
  autoIdCounter += 1
  return `mock-id-${autoIdCounter}`
}

function notifyListeners() {
  listeners.forEach((fire) => fire())
}

export function getFirestore() {
  return { __type: 'firestore-db' }
}

export function collection(first, ...rest) {
  if (first && first.__type === 'doc') {
    return { __type: 'collection', path: `${first.path}/${rest.join('/')}` }
  }
  return { __type: 'collection', path: rest.join('/') }
}

export function doc(first, ...rest) {
  if (first && first.__type === 'collection') {
    const id = rest[0] || genId()
    return { __type: 'doc', path: `${first.path}/${id}`, id }
  }
  const segments = rest
  const id = segments[segments.length - 1]
  return { __type: 'doc', path: segments.join('/'), id }
}

export async function getDoc(ref) {
  const data = store.get(ref.path)
  return {
    id: ref.id,
    exists: () => data !== undefined,
    data: () => data,
    ref,
  }
}

function isDirectChildOf(path, collectionPath) {
  if (!path.startsWith(`${collectionPath}/`)) return false
  return !path.slice(collectionPath.length + 1).includes('/')
}

function matchConstraint(constraint, data) {
  if (constraint.type === 'where') {
    if (constraint.op !== '==') throw new Error(`Mock Firestore only supports '==' in tests, got '${constraint.op}'`)
    return data[constraint.field] === constraint.value
  }
  return true
}

function resolveQuery(refOrQuery) {
  if (refOrQuery.__type === 'collection') {
    return { collectionPath: refOrQuery.path, constraints: [] }
  }
  if (refOrQuery.__type === 'query') {
    return { collectionPath: refOrQuery.collectionPath, constraints: refOrQuery.constraints }
  }
  throw new Error('Unsupported ref passed to getDocs/onSnapshot')
}

function collectDocs(refOrQuery) {
  const { collectionPath, constraints } = resolveQuery(refOrQuery)
  const docs = []
  for (const [path, data] of store.entries()) {
    if (!isDirectChildOf(path, collectionPath)) continue
    if (!constraints.every((c) => matchConstraint(c, data))) continue
    const id = path.slice(collectionPath.length + 1)
    docs.push({ id, data: () => data, ref: { __type: 'doc', path, id } })
  }
  return docs
}

export async function getDocs(refOrQuery) {
  const docs = collectDocs(refOrQuery)
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (fn) => docs.forEach(fn),
  }
}

export function query(collectionRef, ...constraints) {
  return { __type: 'query', collectionPath: collectionRef.path, constraints }
}

export function where(field, op, value) {
  return { type: 'where', field, op, value }
}

export async function addDoc(collectionRef, data) {
  const id = genId()
  const path = `${collectionRef.path}/${id}`
  store.set(path, { ...data })
  notifyListeners()
  return { __type: 'doc', path, id }
}

export async function setDoc(docRef, data, opts) {
  const existing = store.get(docRef.path)
  if (opts && opts.merge && existing) {
    store.set(docRef.path, { ...existing, ...data })
  } else {
    store.set(docRef.path, { ...data })
  }
  notifyListeners()
}

export async function updateDoc(docRef, data) {
  const existing = store.get(docRef.path)
  if (existing === undefined) {
    throw new Error(`Mock Firestore: no document to update at ${docRef.path}`)
  }
  store.set(docRef.path, { ...existing, ...data })
  notifyListeners()
}

export async function deleteDoc(docRef) {
  store.delete(docRef.path)
  notifyListeners()
}

export function writeBatch() {
  const ops = []
  return {
    delete(ref) {
      ops.push(() => store.delete(ref.path))
    },
    update(ref, data) {
      ops.push(() => {
        const existing = store.get(ref.path)
        store.set(ref.path, { ...(existing || {}), ...data })
      })
    },
    set(ref, data) {
      ops.push(() => store.set(ref.path, { ...data }))
    },
    commit: async () => {
      ops.forEach((op) => op())
      notifyListeners()
    },
  }
}

// Fires immediately with current data (matching real Firestore behavior of
// emitting the cached/current state right away), then again on every write.
export function onSnapshot(refOrQuery, onNext, onError) {
  const fire = async () => {
    try {
      if (refOrQuery.__type === 'doc') {
        onNext(await getDoc(refOrQuery))
      } else {
        onNext(await getDocs(refOrQuery))
      }
    } catch (err) {
      if (onError) onError(err)
    }
  }
  listeners.add(fire)
  fire()
  return () => listeners.delete(fire)
}

export function serverTimestamp() {
  const millis = Date.now()
  return { __type: 'timestamp', toMillis: () => millis }
}
