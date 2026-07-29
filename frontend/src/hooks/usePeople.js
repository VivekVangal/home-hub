import { useMemo } from 'react'
import { useLiveData } from './useLiveData.js'
import { getPeople } from '../db.js'
import { ALL } from '../consts.js'

// Central place every page/component gets the current family member list from.
// `owners` includes the synthetic "Everyone" option for assigning shared
// items; `people` is just the real family members (for filter chips, etc).
export function usePeople() {
  const { data, loading, refresh } = useLiveData(getPeople, [])
  const people = data || []
  const owners = useMemo(() => [...people, ALL], [people])
  const ownerById = useMemo(
    () => Object.fromEntries([...people, ALL].map((p) => [p.id, p])),
    [people]
  )
  return { people, owners, ownerById, loading, refresh }
}
