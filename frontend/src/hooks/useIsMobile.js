import { useEffect, useState } from 'react'

// Tracks whether the viewport is at/below `breakpoint` (720px by default —
// same width NavBar.jsx already switches to the hamburger drawer at, purely
// in CSS since it doesn't need different data). This hook exists for
// callers that need to fetch/compute something different on mobile, not
// just style it differently — CSS alone can't do that.
export function useIsMobile(breakpoint = 720) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  )

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const onChange = (e) => setIsMobile(e.matches)
    query.addEventListener('change', onChange)
    setIsMobile(query.matches)
    return () => query.removeEventListener('change', onChange)
  }, [breakpoint])

  return isMobile
}
