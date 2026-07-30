import { describe, test, expect } from 'vitest'
import {
  parseGarminActivitiesCsv, matchGarminActivitiesToSessions, garminActivityToSessionFields,
} from '../../lib/garminImport.js'

const HEADER = '"Activity Type","Date","Distance","Time","Title"'

function csvRow({ type, date, distance, time, title }) {
  return `"${type}","${date}","${distance}","${time}","${title}"`
}

describe('parseGarminActivitiesCsv', () => {
  test('parses running rows and skips non-running activity types', () => {
    const csv = [
      HEADER,
      csvRow({ type: 'Running', date: '2026-08-01 06:15:23', distance: '3.11', time: '0:25:00', title: 'Easy run' }),
      csvRow({ type: 'Cycling', date: '2026-08-02 07:00:00', distance: '10.0', time: '0:40:00', title: 'Bike ride' }),
    ].join('\n')

    const activities = parseGarminActivitiesCsv(csv)
    expect(activities).toHaveLength(1)
    expect(activities[0].activityType).toBe('Running')
    expect(activities[0].date).toBe('2026-08-01')
    expect(activities[0].distanceMiles).toBeCloseTo(3.11, 2)
    expect(activities[0].durationMinutes).toBe(25)
    expect(activities[0].title).toBe('Easy run')
  })

  test('treats Treadmill Running as a running activity type', () => {
    const csv = [
      HEADER,
      csvRow({ type: 'Treadmill Running', date: '2026-08-01 06:15:23', distance: '3', time: '0:24:00', title: 'Treadmill' }),
    ].join('\n')

    expect(parseGarminActivitiesCsv(csv)).toHaveLength(1)
  })

  test('is case-insensitive on activity type', () => {
    const csv = [
      HEADER,
      csvRow({ type: 'running', date: '2026-08-01 06:15:23', distance: '3', time: '0:24:00', title: 'lowercase type' }),
    ].join('\n')

    expect(parseGarminActivitiesCsv(csv)).toHaveLength(1)
  })

  test('handles a quoted title containing a comma', () => {
    const csv = [
      HEADER,
      '"Running","2026-08-01 06:15:23","3.1","0:25:00","Morning Run, Downtown Loop"',
    ].join('\n')

    const activities = parseGarminActivitiesCsv(csv)
    expect(activities[0].title).toBe('Morning Run, Downtown Loop')
  })

  test('parses a "MM:SS" duration (no hours component)', () => {
    const csv = [
      HEADER,
      csvRow({ type: 'Running', date: '2026-08-01 06:15:23', distance: '1', time: '8:30', title: 'Short run' }),
    ].join('\n')

    expect(parseGarminActivitiesCsv(csv)[0].durationMinutes).toBeCloseTo(8.5, 2)
  })

  test('returns an empty array when required columns are missing from the header', () => {
    const csv = ['"Distance","Time"', '"3.1","0:25:00"'].join('\n')
    expect(parseGarminActivitiesCsv(csv)).toEqual([])
  })

  test('returns an empty array for a header-only file', () => {
    expect(parseGarminActivitiesCsv(HEADER)).toEqual([])
  })
})

describe('matchGarminActivitiesToSessions', () => {
  const session = (date, extra = {}) => ({ id: date, date, ...extra })
  const activity = (date, extra = {}) => ({ date, activityType: 'Running', distanceMiles: 3, durationMinutes: 25, title: null, ...extra })

  test('matches an activity to the session on the same date', () => {
    const sessions = [session('2026-08-01'), session('2026-08-02')]
    const matches = matchGarminActivitiesToSessions([activity('2026-08-01')], sessions)
    expect(matches).toHaveLength(1)
    expect(matches[0].session.date).toBe('2026-08-01')
  })

  test('skips sessions that already have garminImported set', () => {
    const sessions = [session('2026-08-01', { garminImported: true })]
    expect(matchGarminActivitiesToSessions([activity('2026-08-01')], sessions)).toHaveLength(0)
  })

  test('skips dates with no scheduled session', () => {
    const sessions = [session('2026-08-02')]
    expect(matchGarminActivitiesToSessions([activity('2026-08-01')], sessions)).toHaveLength(0)
  })

  test('only matches the first activity per date', () => {
    const sessions = [session('2026-08-01')]
    const activities = [activity('2026-08-01', { title: 'first' }), activity('2026-08-01', { title: 'second' })]
    const matches = matchGarminActivitiesToSessions(activities, sessions)
    expect(matches).toHaveLength(1)
    expect(matches[0].activity.title).toBe('first')
  })
})

describe('garminActivityToSessionFields', () => {
  test('converts an activity into event fields', () => {
    const fields = garminActivityToSessionFields({ distanceMiles: 3, durationMinutes: 25, title: 'Tempo run' })
    expect(fields.sessionStatus).toBe('done')
    expect(fields.garminImported).toBe(true)
    expect(fields.garminActivityTitle).toBe('Tempo run')
    expect(fields.actualDistanceMiles).toBe(3)
    expect(fields.actualDurationMinutes).toBe(25)
    expect(fields.actualPaceMinPerMile).toBeCloseTo(8.33, 1)
  })

  test('handles missing distance/duration gracefully', () => {
    const fields = garminActivityToSessionFields({ distanceMiles: null, durationMinutes: null, title: null })
    expect(fields.actualDistanceMiles).toBeNull()
    expect(fields.actualDurationMinutes).toBeNull()
    expect(fields.actualPaceMinPerMile).toBeNull()
  })
})
