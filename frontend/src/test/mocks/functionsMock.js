// A minimal fake of the 'firebase/functions' modular SDK. Real
// httpsCallable() posts to a deployed Cloud Function; this fake instead
// looks up a handler tests register via setCallableHandler() and calls that
// directly, matching the real SDK's { data } response/thrown-error shape
// closely enough for TrainingPage.jsx's Strava integration to be tested
// without a live function.

let handlers = new Map()

export function resetFunctionsMock() {
  handlers = new Map()
}

// Test helper — registers what a given callable name should do when
// invoked. `handler` receives the call's `data` payload and may return a
// value (sync or async) or throw/reject.
export function setCallableHandler(name, handler) {
  handlers.set(name, handler)
}

export function getFunctions() {
  return { __type: 'functions' }
}

export function httpsCallable(functionsInstance, name) {
  return async (data) => {
    const handler = handlers.get(name)
    if (!handler) throw new Error(`No mock handler registered for callable "${name}"`)
    return { data: await handler(data) }
  }
}
