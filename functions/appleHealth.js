// ---------------------------------------------------------------------------
// Pure helpers for the Apple Health webhook. Apple Health has no server-side
// account to authenticate against at all — HealthKit data lives on-device,
// and iCloud's copy of it is end-to-end encrypted (not even Apple can read
// it). So unlike Strava/Terra, there's no OAuth or login flow here: a
// personal Shortcuts automation on the user's own phone POSTs a workout as
// JSON straight to appleHealthWebhook (see index.js) after each run, and
// authentication is a long random per-user token in the URL rather than a
// signature header — there's no Apple-issued signing secret to check
// against, since Apple isn't the one calling this endpoint.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto'
import { metersToMiles, paceMinPerMile, fmtPace } from './strava.js'

export { metersToMiles, paceMinPerMile, fmtPace }

// Apple Health's own vocabulary (surfaced by Shortcuts' "Workout Type") is
// closer to plain English than Garmin/Terra's numeric enums. Casing varies
// by iOS version, hence the lowercasing before comparing.
const RUNNING_WORKOUT_TYPES = new Set([
  'running', 'run', 'jogging', 'treadmill running', 'indoor run', 'indoor running',
])

export function isRunningWorkout(workoutType) {
  return RUNNING_WORKOUT_TYPES.has(String(workoutType || '').trim().toLowerCase())
}

export function generateWebhookToken() {
  return crypto.randomBytes(24).toString('hex')
}

// A cheap shape check (48 lowercase hex chars, matching what
// generateWebhookToken() produces) before bothering Firestore with an
// obviously-wrong value — the real authentication is the Firestore lookup
// in index.js, this just avoids a wasted read for garbage input.
export function isPlausibleToken(token) {
  return typeof token === 'string' && /^[0-9a-f]{48}$/.test(token)
}

// Distance can arrive in whichever unit was easiest to pull out of Health in
// Shortcuts (miles is simplest to wire up, but km/meters are accepted too so
// nobody has to fight iOS's unit settings to get this working).
function distanceMilesFromPayload(payload) {
  if (payload.distanceMiles != null) return Number(payload.distanceMiles)
  if (payload.distanceKm != null) return Number(payload.distanceKm) * 0.621371
  if (payload.distanceMeters != null) return metersToMiles(Number(payload.distanceMeters))
  return null
}

function durationMinutesFromPayload(payload) {
  if (payload.durationMinutes != null) return Number(payload.durationMinutes)
  if (payload.startDate && payload.endDate) {
    return (new Date(payload.endDate) - new Date(payload.startDate)) / 60000
  }
  return null
}

export function activityLocalDate(payload) {
  return payload.startDate?.slice(0, 10)
}

// Converts a raw webhook payload into the fields written onto a matched
// training session — same actualDistanceMiles/actualDurationMinutes/
// actualPaceMinPerMile/sessionStatus convention as Strava/Terra, so
// TrainingPage.jsx doesn't need separate rendering logic per provider.
export function appleHealthToSessionFields(payload) {
  const distanceMiles = distanceMilesFromPayload(payload)
  const durationMinutes = durationMinutesFromPayload(payload)
  const pace = distanceMiles != null && durationMinutes != null ? paceMinPerMile(distanceMiles, durationMinutes) : null
  return {
    sessionStatus: 'done',
    appleHealthImported: true,
    appleHealthWorkoutType: payload.workoutType || null,
    actualDistanceMiles: distanceMiles == null ? null : Math.round(distanceMiles * 100) / 100,
    actualDurationMinutes: durationMinutes == null ? null : Math.round(durationMinutes * 10) / 10,
    actualPaceMinPerMile: pace == null ? null : Math.round(pace * 100) / 100,
  }
}

// Finds the one training session this incoming workout should update: same
// date, not already imported from Apple Health, and only if the workout is
// actually a run (a webhook receiving every workout type shouldn't clobber a
// running session with, say, a bike ride logged the same day). Pulled out
// as a pure function so index.js's webhook handler stays a thin wrapper
// around Firestore reads/writes.
export function findMatchingSession(sessions, payload) {
  if (!isRunningWorkout(payload.workoutType)) return null
  const date = activityLocalDate(payload)
  if (!date) return null
  return sessions.find((s) => s.date === date && !s.appleHealthImported) || null
}
