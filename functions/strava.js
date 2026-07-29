// ---------------------------------------------------------------------------
// Pure Strava sync helpers — no Firestore/network calls here, so this stays
// easy to unit test (see strava.test.js). index.js wires these to the real
// HTTP calls and Firestore reads/writes.
// ---------------------------------------------------------------------------

export const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
export const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities'

export function metersToMiles(meters) {
  return meters / 1609.34
}

export function secondsToMinutes(seconds) {
  return seconds / 60
}

export function paceMinPerMile(distanceMiles, durationMinutes) {
  if (!distanceMiles) return null
  return durationMinutes / distanceMiles
}

export function fmtPace(minutesPerMile) {
  if (minutesPerMile == null) return null
  const m = Math.floor(minutesPerMile)
  const s = Math.round((minutesPerMile - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}/mi`
}

// Strava's `start_date_local` is an ISO string already shifted to the
// athlete's local wall-clock time (e.g. "2026-07-29T06:15:00Z") — the date
// portion is what we match a scheduled session against.
export function activityLocalDate(activity) {
  return activity.start_date_local.slice(0, 10)
}

// Pairs each unmatched Strava Run activity with the training session on the
// same date that doesn't already carry a stravaActivityId. There's at most
// one trainingPlan session per day already (see lib/trainingPlan.js), so
// date equality is enough — a run logged on a "rest day" still counts. Only
// the first activity per date is matched, so a second run on the same day
// doesn't clobber the first match. Returns [{ session, activity }].
export function matchActivitiesToSessions(activities, sessions) {
  const runs = activities.filter((a) => a.type === 'Run')
  const claimedDates = new Set()
  const matches = []
  for (const activity of runs) {
    const date = activityLocalDate(activity)
    if (claimedDates.has(date)) continue
    const session = sessions.find((s) => s.date === date && !s.stravaActivityId)
    if (!session) continue
    claimedDates.add(date)
    matches.push({ session, activity })
  }
  return matches
}

// Converts a matched Strava activity into the fields written onto its
// training session event.
export function activityToSessionFields(activity) {
  const distanceMiles = metersToMiles(activity.distance)
  const durationMinutes = secondsToMinutes(activity.moving_time)
  const pace = paceMinPerMile(distanceMiles, durationMinutes)
  return {
    sessionStatus: 'done',
    stravaActivityId: String(activity.id),
    stravaActivityName: activity.name,
    actualDistanceMiles: Math.round(distanceMiles * 100) / 100,
    actualDurationMinutes: Math.round(durationMinutes * 10) / 10,
    actualPaceMinPerMile: pace == null ? null : Math.round(pace * 100) / 100,
  }
}
