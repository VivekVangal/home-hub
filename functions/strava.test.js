import { describe, test, expect } from 'vitest'
import {
  metersToMiles, secondsToMinutes, paceMinPerMile, fmtPace,
  matchActivitiesToSessions, activityToSessionFields,
} from './strava.js'

describe('unit conversions', () => {
  test('metersToMiles', () => {
    expect(metersToMiles(1609.34)).toBeCloseTo(1, 5)
  })

  test('secondsToMinutes', () => {
    expect(secondsToMinutes(120)).toBe(2)
  })

  test('paceMinPerMile', () => {
    expect(paceMinPerMile(3, 24)).toBe(8)
  })

  test('paceMinPerMile handles zero distance', () => {
    expect(paceMinPerMile(0, 24)).toBeNull()
  })

  test('fmtPace', () => {
    expect(fmtPace(8.5)).toBe('8:30/mi')
  })
})

describe('matchActivitiesToSessions', () => {
  const session = (date, extra = {}) => ({ id: date, date, ...extra })
  const activity = (date, overrides = {}) => ({
    id: 123,
    type: 'Run',
    start_date_local: `${date}T06:00:00Z`,
    distance: 4828,
    moving_time: 1500,
    name: 'Morning Run',
    ...overrides,
  })

  test('matches a run to the session on the same date', () => {
    const sessions = [session('2026-08-01'), session('2026-08-02')]
    const activities = [activity('2026-08-01')]
    const matches = matchActivitiesToSessions(activities, sessions)
    expect(matches).toHaveLength(1)
    expect(matches[0].session.date).toBe('2026-08-01')
  })

  test('ignores non-Run activities', () => {
    const sessions = [session('2026-08-01')]
    const activities = [activity('2026-08-01', { type: 'Ride' })]
    expect(matchActivitiesToSessions(activities, sessions)).toHaveLength(0)
  })

  test('skips sessions that already have a stravaActivityId', () => {
    const sessions = [session('2026-08-01', { stravaActivityId: 'already-set' })]
    const activities = [activity('2026-08-01')]
    expect(matchActivitiesToSessions(activities, sessions)).toHaveLength(0)
  })

  test('skips dates with no scheduled session', () => {
    const sessions = [session('2026-08-02')]
    const activities = [activity('2026-08-01')]
    expect(matchActivitiesToSessions(activities, sessions)).toHaveLength(0)
  })

  test('only matches the first activity per date', () => {
    const sessions = [session('2026-08-01')]
    const activities = [activity('2026-08-01'), activity('2026-08-01', { id: 456 })]
    const matches = matchActivitiesToSessions(activities, sessions)
    expect(matches).toHaveLength(1)
    expect(matches[0].activity.id).toBe(123)
  })
})

describe('activityToSessionFields', () => {
  test('converts a Strava activity into event fields', () => {
    const fields = activityToSessionFields({
      id: 999, name: 'Tempo run', distance: 4828, moving_time: 1500,
    })
    expect(fields.sessionStatus).toBe('done')
    expect(fields.stravaActivityId).toBe('999')
    expect(fields.stravaActivityName).toBe('Tempo run')
    expect(fields.actualDistanceMiles).toBeCloseTo(3, 1)
    expect(fields.actualDurationMinutes).toBe(25)
    expect(fields.actualPaceMinPerMile).toBeCloseTo(8.33, 1)
  })
})
