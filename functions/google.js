// ---------------------------------------------------------------------------
// Pure helpers for Google Calendar/Tasks import — no Firestore/network calls
// here, so this stays easy to unit test (see google.test.js). index.js wires
// these to the real HTTP calls and Firestore reads/writes, same split as
// strava.js/index.js.
// ---------------------------------------------------------------------------

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
export const GOOGLE_TASKS_URL = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks'

const CALENDAR_LOOKBACK_DAYS = 7
const CALENDAR_LOOKAHEAD_DAYS = 90

// A window centered on "now" rather than a pure lookback like Strava's sync
// — this is a general calendar, not just a log of past runs, so it needs to
// pull upcoming events too.
export function calendarSyncWindow(nowMs = Date.now()) {
  return {
    timeMin: new Date(nowMs - CALENDAR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    timeMax: new Date(nowMs + CALENDAR_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  }
}

// Google Calendar's start/end objects are either `{ date: 'YYYY-MM-DD' }'
// for all-day events or `{ dateTime: 'YYYY-MM-DDTHH:MM:SS±HH:MM' }` for
// timed ones — never both.
function extractDateAndTime(dateTimeObj) {
  if (!dateTimeObj) return { date: null, time: '' }
  if (dateTimeObj.date) return { date: dateTimeObj.date, time: '' }
  if (dateTimeObj.dateTime) {
    return { date: dateTimeObj.dateTime.slice(0, 10), time: dateTimeObj.dateTime.slice(11, 16) }
  }
  return { date: null, time: '' }
}

// Converts a raw Google Calendar API event into Home Hub event fields, or
// null to skip it entirely (cancelled, or missing a start date entirely —
// shouldn't happen in practice but better to skip than write a broken event).
// `owner` isn't set here — that's caller context (the connecting uid), not
// something derived from the Google data itself.
export function mapGoogleEventToFields(event) {
  if (event.status === 'cancelled') return null
  const start = extractDateAndTime(event.start)
  if (!start.date) return null
  const end = extractDateAndTime(event.end)
  return {
    googleEventId: event.id,
    googleImported: true,
    title: event.summary || '(untitled)',
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    notes: event.description || '',
  }
}

// Converts a raw Google Tasks API task into Home Hub task fields. Unlike
// events, every task is worth importing (no analogous "cancelled" state).
export function mapGoogleTaskToFields(task) {
  return {
    googleTaskId: task.id,
    googleImported: true,
    type: 'todo',
    title: task.title || '(untitled)',
    dueDate: task.due ? task.due.slice(0, 10) : '',
    notes: task.notes || '',
    done: task.status === 'completed',
  }
}

// Splits a batch of incoming Google items into creates and updates against
// what's already been imported, keyed by `idField` (googleEventId or
// googleTaskId) — re-syncing updates the matching doc instead of creating a
// duplicate. `mapFn` may return null to skip an item (see
// mapGoogleEventToFields's cancelled-event case); skipped items are neither
// created nor updated.
export function planUpserts(existingItems, incomingRawItems, { idField, mapFn }) {
  const toCreate = []
  const toUpdate = []
  for (const raw of incomingRawItems) {
    const fields = mapFn(raw)
    if (!fields) continue
    const existing = existingItems.find((item) => item[idField] === fields[idField])
    if (existing) {
      toUpdate.push({ id: existing.id, fields })
    } else {
      toCreate.push(fields)
    }
  }
  return { toCreate, toUpdate }
}
