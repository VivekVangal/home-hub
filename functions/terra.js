// ---------------------------------------------------------------------------
// Pure Terra sync helpers — no Firestore/network calls here, so this stays
// easy to unit test (see terra.test.js). index.js wires these to the real
// HTTP calls, webhook handling, and Firestore reads/writes.
//
// Terra (tryterra.co) is a unified wearable-data aggregator that covers
// Garmin, Fitbit, Apple Health, Oura, Whoop, Polar, Strava, and 500+ others
// through one integration - chosen over integrating each provider directly
// (Garmin's own API requires a legal-entity business application; Strava's
// direct API caps free access at 10 athletes). See TASKS.md for that
// research trail.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto'
import { metersToMiles, secondsToMinutes, paceMinPerMile, fmtPace } from './strava.js'

export { metersToMiles, secondsToMinutes, paceMinPerMile, fmtPace }

export const TERRA_API_BASE = 'https://api.tryterra.co/v2'

// Terra's ActivityType enum (see docs.tryterra.co/reference/health-and-fitness-api/data-models)
// - only the running-like values matter for matching against training-plan
// sessions here.
export const RUNNING_ACTIVITY_TYPES = new Set([
  8,   // Running
  56,  // Jogging
  57,  // Running On Sand
  58,  // Treadmill Running
  133, // Indoor Running
])

// Terra's `metadata.start_time` is ISO-8601. Unlike Strava's
// `start_date_local`, Terra doesn't always guarantee local-time shifting
// (see `timestamp_localization` in its data model) - taking the date portion
// directly is the same simplification already accepted for Strava's version.
export function activityLocalDate(activity) {
  return activity.metadata?.start_time?.slice(0, 10)
}

function durationSecondsFromActivity(activity) {
  const active = activity.active_durations_data?.activity_seconds
  if (active != null) return active
  const start = activity.metadata?.start_time
  const end = activity.metadata?.end_time
  if (start && end) return (new Date(end) - new Date(start)) / 1000
  return null
}

// Same matching strategy as Strava's version: one training session per day,
// first unmatched running-type activity on that date wins, sessions that
// already carry a terraActivityId are skipped. Returns [{ session, activity }].
export function matchActivitiesToSessions(activities, sessions) {
  const runs = activities.filter((a) => RUNNING_ACTIVITY_TYPES.has(a.metadata?.type))
  const claimedDates = new Set()
  const matches = []
  for (const activity of runs) {
    const date = activityLocalDate(activity)
    if (!date || claimedDates.has(date)) continue
    const session = sessions.find((s) => s.date === date && !s.terraActivityId)
    if (!session) continue
    claimedDates.add(date)
    matches.push({ session, activity })
  }
  return matches
}

// Converts a matched Terra activity into the fields written onto its
// training session event. Uses the same actualDistanceMiles/
// actualDurationMinutes/actualPaceMinPerMile field names Strava's sync
// writes, so TrainingPage.jsx doesn't need separate rendering logic per
// provider - only the *ActivityId/*ActivityName fields differ.
export function activityToSessionFields(activity) {
  const distanceMeters = activity.distance_data?.summary?.distance_meters
  const distanceMiles = distanceMeters != null ? metersToMiles(distanceMeters) : null
  const durationSeconds = durationSecondsFromActivity(activity)
  const durationMinutes = durationSeconds != null ? secondsToMinutes(durationSeconds) : null
  const pace = distanceMiles != null && durationMinutes != null ? paceMinPerMile(distanceMiles, durationMinutes) : null
  return {
    sessionStatus: 'done',
    terraActivityId: String(activity.metadata?.summary_id ?? ''),
    terraActivityName: activity.metadata?.name || null,
    actualDistanceMiles: distanceMiles == null ? null : Math.round(distanceMiles * 100) / 100,
    actualDurationMinutes: durationMinutes == null ? null : Math.round(durationMinutes * 10) / 10,
    actualPaceMinPerMile: pace == null ? null : Math.round(pace * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// Webhook signature verification — Terra's documented manual-verification
// algorithm (docs.tryterra.co/reference/health-and-fitness-api/destinations):
// header is `t=<unix-seconds>,v1=<hex-hmac-sha256>`, signed payload is
// `${timestamp}.${rawBody}`, key is the signing secret from the Terra
// dashboard. `nowSeconds`/`toleranceSeconds` are injectable for testing.
// ---------------------------------------------------------------------------

export function computeTerraSignature(timestamp, rawBody, signingSecret) {
  return crypto.createHmac('sha256', signingSecret).update(`${timestamp}.${rawBody}`).digest('hex')
}

export function verifyTerraWebhookSignature(rawBody, signatureHeader, signingSecret, opts = {}) {
  const { nowSeconds = Date.now() / 1000, toleranceSeconds = 300 } = opts
  if (!signatureHeader || !signingSecret) return false

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.trim().split('=')).filter((pair) => pair.length === 2)
  )
  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) return false

  const expected = computeTerraSignature(timestamp, rawBody, signingSecret)
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(signature, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}
