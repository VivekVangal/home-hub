// ---------------------------------------------------------------------------
// Client-side Apple Health helper. There's no connect/OAuth flow here at
// all — see functions/appleHealth.js's header comment for why — so unlike
// strava.js/terra.js this file only has a summary formatter, not a connect
// URL builder. The webhook URL itself is generated on demand by calling the
// generateAppleHealthWebhookUrl Cloud Function directly from
// pages/TrainingPage.jsx.
// ---------------------------------------------------------------------------

// One-line summary of a session's actual (Apple Health-synced) distance/
// duration/pace, or null if it hasn't been matched to a workout yet. Mirrors
// formatStravaSummary/formatTerraSummary — same underlying event fields,
// just keyed off appleHealthImported instead of a provider activity id
// (Apple Health workouts don't carry a stable id worth storing).
export function formatAppleHealthSummary(event) {
  if (!event.appleHealthImported) return null
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
