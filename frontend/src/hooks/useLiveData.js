import { useCallback, useEffect, useRef, useState } from 'react'

// Generic "live query" hook: runs `fetcher()`, re-runs whenever db.js writes
// anything (any page adds/edits/deletes), and whenever `deps` change.
// This is what keeps the Dashboard, Calendar, and Grocery pages in sync.
export function useLiveData(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  // Tracks whether this `load` identity has resolved at least once, so a
  // burst of unrelated 'homehub:change' events (e.g. every family-scoped
  // collection notifying once when a page first subscribes) doesn't flip
  // `loading` back to true and flash already-rendered data away. Reset
  // whenever `deps` change below, so switching to a genuinely different
  // resource still shows a loading state.
  const loadedOnceRef = useRef(false)

  const load = useCallback(() => {
    if (!loadedOnceRef.current) setLoading(true)
    Promise.resolve(fetcher()).then((result) => {
      loadedOnceRef.current = true
      setData(result)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    loadedOnceRef.current = false
    load()
    window.addEventListener('homehub:change', load)
    return () => window.removeEventListener('homehub:change', load)
  }, [load])

  return { data, loading, refresh: load }
}
