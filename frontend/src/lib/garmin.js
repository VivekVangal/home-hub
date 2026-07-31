// Display helper for Garmin-imported sessions — mirrors
// formatStravaSummary/formatAppleHealthSummary. Kept separate from
// garminImport.js (the CSV parsing/matching logic) the same way Strava
// splits its connect-flow helpers (lib/strava.js) from anything more mechanical.

export function formatGarminSummary(event) {
  if (!event.garminImported) return null
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
