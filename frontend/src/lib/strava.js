// ---------------------------------------------------------------------------
// Client-side Strava helpers. The OAuth exchange and activity sync
// themselves happen server-side (functions/index.js, functions/strava.js)
// since Strava's client secret can never reach the browser — this module is
// just the pieces that legitimately belong on the client: building the
// authorize URL (client id isn't secret) and formatting synced results
// that TrainingPage.jsx and WeekCalendar.jsx both display.
// ---------------------------------------------------------------------------

export function buildStravaAuthorizeUrl(redirectUri) {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_only',
  })
  return `https://www.strava.com/oauth/authorize?${params}`
}

// One-line summary of a session's actual (Strava-synced) distance/duration/
// pace, or null if it hasn't been matched to an activity yet.
export function formatStravaSummary(event) {
  if (!event.stravaActivityId) return null
  const distance = event.actualDistanceMiles
  const duration = event.actualDurationMinutes
  const pace = event.actualPaceMinPerMile
  const parts = []
  if (distance != null) parts.push(`${distance} mi`)
  if (duration != null) parts.push(fmtDuration(duration))
  const summary = parts.join(' in ')
  return pace != null ? `${summary} (${fmtPace(pace)})` : summary
}

function fmtDuration(totalMinutes) {
  const wholeSeconds = Math.round(totalMinutes * 60)
  const m = Math.floor(wholeSeconds / 60)
  const s = wholeSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtPace(minutesPerMile) {
  const m = Math.floor(minutesPerMile)
  const s = Math.round((minutesPerMile - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}/mi`
}
