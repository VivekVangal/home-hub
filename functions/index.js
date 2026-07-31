// ---------------------------------------------------------------------------
// Cloud Functions for the Training page's Strava integration. Two callables,
// both keyed off the caller's verified auth uid (never a client-supplied
// one). Strava's client secret lives in Secret Manager (see
// `firebase functions:secrets:set STRAVA_CLIENT_SECRET` in README/TASKS.md)
// and never reaches the browser — that's the whole reason this needs a
// Cloud Function instead of living in frontend/.
// ---------------------------------------------------------------------------

import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { STRAVA_TOKEN_URL, STRAVA_ACTIVITIES_URL, matchActivitiesToSessions, activityToSessionFields } from './strava.js'
import {
  generateWebhookToken,
  isPlausibleToken,
  appleHealthToSessionFields,
  findMatchingSession as findMatchingAppleHealthSession,
} from './appleHealth.js'

initializeApp()
const db = getFirestore()

const stravaClientId = defineSecret('STRAVA_CLIENT_ID')
const stravaClientSecret = defineSecret('STRAVA_CLIENT_SECRET')

const SYNC_LOOKBACK_DAYS = 45

async function resolveFamilyId(uid) {
  const userDoc = await db.doc(`users/${uid}`).get()
  const familyId = userDoc.data()?.familyId
  if (!familyId) throw new HttpsError('failed-precondition', 'No family found for this account.')
  return familyId
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.')
  return request.auth.uid
}

export const stravaExchangeCode = onCall({ secrets: [stravaClientId, stravaClientSecret] }, async (request) => {
  const uid = requireAuth(request)
  const code = request.data?.code
  if (!code) throw new HttpsError('invalid-argument', 'Missing authorization code.')

  const familyId = await resolveFamilyId(uid)

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: stravaClientId.value(),
      client_secret: stravaClientSecret.value(),
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new HttpsError('internal', `Strava token exchange failed: ${await res.text()}`)
  const tokens = await res.json()

  await db.doc(`families/${familyId}/stravaTokens/${uid}`).set({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_at,
    athleteId: tokens.athlete?.id ?? null,
    updatedAt: Date.now(),
  })
  await db.doc(`families/${familyId}/trainingProfiles/${uid}`).set({ stravaConnected: true }, { merge: true })

  return { connected: true }
})

// Refreshes the stored access token if it's expired (or about to be), and
// returns a token that's good to use right now.
async function getFreshAccessToken(familyId, uid) {
  const ref = db.doc(`families/${familyId}/stravaTokens/${uid}`)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('failed-precondition', 'Strava is not connected.')
  const tokens = snap.data()

  const nowSeconds = Date.now() / 1000
  if (tokens.expiresAt > nowSeconds + 60) return tokens.accessToken

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: stravaClientId.value(),
      client_secret: stravaClientSecret.value(),
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new HttpsError('internal', `Strava token refresh failed: ${await res.text()}`)
  const refreshed = await res.json()

  await ref.set({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: refreshed.expires_at,
    updatedAt: Date.now(),
  }, { merge: true })

  return refreshed.access_token
}

export const stravaSync = onCall({ secrets: [stravaClientId, stravaClientSecret] }, async (request) => {
  const uid = requireAuth(request)
  const familyId = await resolveFamilyId(uid)

  const accessToken = await getFreshAccessToken(familyId, uid)

  const after = Math.floor(Date.now() / 1000) - SYNC_LOOKBACK_DAYS * 24 * 60 * 60
  const activitiesRes = await fetch(`${STRAVA_ACTIVITIES_URL}?after=${after}&per_page=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!activitiesRes.ok) throw new HttpsError('internal', `Strava activities fetch failed: ${await activitiesRes.text()}`)
  const activities = await activitiesRes.json()

  // Single-field-plus-equality query, same pattern as clearCheckedGroceryItems
  // in frontend/src/db.js — no composite index needed (see README/ARCHITECTURE.md).
  const eventsSnap = await db
    .collection(`families/${familyId}/events`)
    .where('trainingPlan', '==', true)
    .where('owner', '==', uid)
    .get()
  const sessions = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const matches = matchActivitiesToSessions(activities, sessions)

  if (matches.length) {
    const batch = db.batch()
    for (const { session, activity } of matches) {
      batch.update(db.doc(`families/${familyId}/events/${session.id}`), activityToSessionFields(activity))
    }
    await batch.commit()
  }

  return { matchedCount: matches.length, activityCount: activities.length }
})

// ---------------------------------------------------------------------------
// Apple Health - unlike Strava, there's no cloud account to
// authenticate against at all (HealthKit data lives on-device, and iCloud's
// copy is end-to-end encrypted). So instead of OAuth, this is a one-time
// generated URL containing a long random token: the user points a personal
// Shortcuts automation at it, and it POSTs a workout as JSON after each run.
// See functions/appleHealth.js for the payload shape and README.md for the
// exact Shortcuts setup steps. No Firebase secrets needed for this one - the
// token itself, stored in Firestore, is what stands in for a client secret.
// ---------------------------------------------------------------------------

export const generateAppleHealthWebhookUrl = onCall(async (request) => {
  const uid = requireAuth(request)
  const familyId = await resolveFamilyId(uid)

  // Only one active webhook URL per person — mint a new token and invalidate
  // whatever token they had before, so an old, possibly-shared URL stops
  // working the moment a new one is generated.
  const existing = await db.collection('appleHealthTokens').where('uid', '==', uid).get()
  const batch = db.batch()
  existing.forEach((d) => batch.delete(d.ref))

  const token = generateWebhookToken()
  batch.set(db.doc(`appleHealthTokens/${token}`), { uid, familyId, createdAt: Date.now() })
  await batch.commit()

  await db.doc(`families/${familyId}/trainingProfiles/${uid}`).set({ appleHealthConnected: true }, { merge: true })

  // 2nd-gen onRequest functions are still reachable at this stable,
  // region+project URL alongside their Cloud Run URL - see Firebase's
  // Cloud Functions docs on 2nd-gen HTTPS URLs.
  const region = 'us-central1'
  const projectId = process.env.GCLOUD_PROJECT
  return { url: `https://${region}-${projectId}.cloudfunctions.net/appleHealthWebhook?token=${token}` }
})

// HTTP (not callable) - a Shortcuts automation POSTs directly to this URL,
// authenticated by the ?token= query param rather than a signature header
// (there's no Apple-issued secret to verify against, since Apple isn't the
// one calling this).
export const appleHealthWebhook = onRequest(async (req, res) => {
  const token = req.query.token
  if (!isPlausibleToken(token)) {
    res.status(401).send('Invalid or missing token')
    return
  }

  const tokenSnap = await db.doc(`appleHealthTokens/${token}`).get()
  if (!tokenSnap.exists) {
    res.status(401).send('Unknown token')
    return
  }
  const { uid, familyId } = tokenSnap.data()

  const payload = req.body || {}
  try {
    const eventsSnap = await db
      .collection(`families/${familyId}/events`)
      .where('trainingPlan', '==', true)
      .where('owner', '==', uid)
      .get()
    const sessions = eventsSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))

    const session = findMatchingAppleHealthSession(sessions, payload)
    if (!session) {
      res.status(200).send('ignored (not a running workout, or no matching scheduled session)')
      return
    }
    await session.ref.update(appleHealthToSessionFields(payload))
    res.status(200).send('ok')
  } catch (err) {
    console.error('appleHealthWebhook error', err)
    res.status(500).send('error')
  }
})
