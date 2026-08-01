// ---------------------------------------------------------------------------
// Client-side Google Calendar/Tasks helper. The OAuth exchange and the
// actual Calendar/Tasks fetch happen server-side (functions/index.js,
// functions/google.js) since Google's client secret can never reach the
// browser — this module is just building the authorize URL (client id isn't
// secret). Unlike lib/strava.js, there's no per-item summary formatter here:
// imported events/tasks are just normal events/tasks, no extra synced data
// (pace, distance) worth surfacing beyond the item itself.
// ---------------------------------------------------------------------------

export function buildGoogleAuthorizeUrl(redirectUri) {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
    // Google only returns a refresh token when both of these are set on the
    // first consent — without them, syncing would stop working the moment
    // the short-lived access token expires.
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}
