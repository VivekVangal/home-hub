// ---------------------------------------------------------------------------
// Client-side Terra helpers. Unlike Strava's classic OAuth-code exchange,
// Terra's connect flow is entirely hosted: the client asks a Cloud Function
// (terraGenerateWidgetSession, see functions/index.js) for a one-time widget
// URL, redirects the browser there, and Terra handles the provider picker +
// auth itself. There's no code to exchange client-side - the connection
// result arrives asynchronously via terraWebhook, not a URL parameter here.
// ---------------------------------------------------------------------------

// One-line summary of a session's actual (Terra-synced) distance/duration/
// pace, or null if it hasn't been matched to an activity yet. Mirrors
// formatStravaSummary in lib/strava.js — same underlying event fields
// (actualDistanceMiles/actualDurationMinutes/actualPaceMinPerMile), just
// keyed off terraActivityId instead of stravaActivityId.
export function formatTerraSummary(event) {
  if (!event.terraActivityId) return null
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
