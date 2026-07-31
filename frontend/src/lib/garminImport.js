// ---------------------------------------------------------------------------
// Garmin has no self-service personal API (Connect Developer Program is
// business-approval-only, see TASKS.md), so instead of a live sync this
// parses Garmin Connect's own "Export CSV" file from the Activities page and
// matches rows to scheduled training sessions by date — entirely client
// side, no Cloud Function or credentials involved, since it's just reading a
// file the user already has.
// ---------------------------------------------------------------------------

// Hand-rolled rather than adding a CSV-parsing dependency (e.g. Papaparse) —
// this sandbox can't run `npm install` to vet a new package (see TASKS.md).
// Handles Garmin's export format (every field double-quoted, commas only
// ever inside quotes); not a general-purpose CSV parser — doesn't handle a
// quoted field containing a literal newline, for instance.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  return lines.map((line) => {
    const fields = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
        else if (ch === '"') inQuotes = false
        else current += ch
      } else if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current)
    return fields
  })
}

// Garmin's CSV uses several running-ish "Activity Type" values depending on
// where the run happened — all treated the same way here.
const RUNNING_ACTIVITY_TYPES = new Set([
  'running', 'treadmill running', 'indoor running', 'trail running', 'track running', 'street running',
])

// Accepts "H:MM:SS" or "MM:SS" (Garmin's "Time" column format) and returns
// minutes, or null if it doesn't parse.
function timeToMinutes(timeStr) {
  const parts = String(timeStr || '').trim().split(':').map(Number)
  if (parts.length === 0 || parts.some((p) => Number.isNaN(p))) return null
  if (parts.length === 3) {
    const [h, m, s] = parts
    return h * 60 + m + s / 60
  }
  if (parts.length === 2) {
    const [m, s] = parts
    return m + s / 60
  }
  return null
}

// Parses Garmin Connect's exported Activities CSV into running activities
// only. Distance is read as-is from the "Distance" column, which follows
// whatever unit the Garmin account is displaying in (there's no unit column
// in the export to detect this from) — the Training page tells the user to
// set their Garmin display units to miles before exporting.
export function parseGarminActivitiesCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const header = rows[0].map((h) => h.trim())
  const col = (name) => header.indexOf(name)
  const typeIdx = col('Activity Type')
  const dateIdx = col('Date')
  const distIdx = col('Distance')
  const timeIdx = col('Time')
  const titleIdx = col('Title')
  if (typeIdx === -1 || dateIdx === -1) return []

  return rows
    .slice(1)
    .filter((row) => row.length > 1)
    .map((row) => {
      const activityType = (row[typeIdx] || '').trim()
      const dateRaw = (row[dateIdx] || '').trim()
      const distance = distIdx !== -1 ? parseFloat(row[distIdx]) : NaN
      const durationMinutes = timeIdx !== -1 ? timeToMinutes(row[timeIdx]) : null
      return {
        activityType,
        date: dateRaw.slice(0, 10),
        distanceMiles: Number.isFinite(distance) ? distance : null,
        durationMinutes,
        title: titleIdx !== -1 ? (row[titleIdx] || '').trim() || null : null,
      }
    })
    .filter((a) => a.date && RUNNING_ACTIVITY_TYPES.has(a.activityType.toLowerCase()))
}

// Same matching strategy as Strava: one training session per day,
// first unmatched running activity on that date wins, sessions already
// carrying garminImported are skipped. Returns [{ session, activity }].
export function matchGarminActivitiesToSessions(activities, sessions) {
  const claimedDates = new Set()
  const matches = []
  for (const activity of activities) {
    if (claimedDates.has(activity.date)) continue
    const session = sessions.find((s) => s.date === activity.date && !s.garminImported)
    if (!session) continue
    claimedDates.add(activity.date)
    matches.push({ session, activity })
  }
  return matches
}

// Converts a matched Garmin CSV row into the fields written onto its
// training session event — same actualDistanceMiles/actualDurationMinutes/
// actualPaceMinPerMile/sessionStatus convention as Strava/Apple Health.
export function garminActivityToSessionFields(activity) {
  const pace = activity.distanceMiles != null && activity.durationMinutes != null
    ? activity.durationMinutes / activity.distanceMiles
    : null
  return {
    sessionStatus: 'done',
    garminImported: true,
    garminActivityTitle: activity.title || null,
    actualDistanceMiles: activity.distanceMiles == null ? null : Math.round(activity.distanceMiles * 100) / 100,
    actualDurationMinutes: activity.durationMinutes == null ? null : Math.round(activity.durationMinutes * 10) / 10,
    actualPaceMinPerMile: pace == null ? null : Math.round(pace * 100) / 100,
  }
}
