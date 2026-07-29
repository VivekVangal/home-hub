import { useCallback, useEffect, useState } from 'react'

// Generic "live query" hook: runs `fetcher()`, re-runs whenever db.js writes
// anything (any page adds/edits/deletes), and whenever `deps` change.
// This is what keeps the Dashboard, Calendar, and Grocery pages in sync.
export function useLiveData(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.resolve(fetcher()).then((result) => {
      setData(result)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    load()
    window.addEventListener('homehub:change', load)
    return () => window.removeEventListener('homehub:change', load)
  }, [load])

  return { data, loading, refresh: load }
}
