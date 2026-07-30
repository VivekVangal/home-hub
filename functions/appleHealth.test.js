import { describe, test, expect } from 'vitest'
import {
  isRunningWorkout, generateWebhookToken, isPlausibleToken,
  activityLocalDate, appleHealthToSessionFields, findMatchingSession,
} from './appleHealth.js'

describe('isRunningWorkout', () => {
  test('accepts common running workout type strings, case-insensitively', () => {
    expect(isRunningWorkout('Running')).toBe(true)
    expect(isRunningWorkout('running')).toBe(true)
    expect(isRunningWorkout('Jogging')).toBe(true)
    expect(isRunningWorkout('Treadmill Running')).toBe(true)
  })

  test('rejects non-running workout types', () => {
    expect(isRunningWorkout('Cycling')).toBe(false)
    expect(isRunningWorkout('Swimming')).toBe(false)
    expect(isRunningWorkout(undefined)).toBe(false)
  })
})

describe('generateWebhookToken / isPlausibleToken', () => {
  test('generates a token that passes its own plausibility check', () => {
    const token = generateWebhookToken()
    expect(isPlausibleToken(token)).toBe(true)
  })

  test('generates different tokens on each call', () => {
    expect(generateWebhookToken()).not.toBe(generateWebhookToken())
  })

  test('rejects obviously-wrong tokens', () => {
    expect(isPlausibleToken('not-hex-and-too-short')).toBe(false)
    expect(isPlausibleToken(12345)).toBe(false)
    expect(isPlausibleToken(null)).toBe(false)
    expect(isPlausibleToken('')).toBe(false)
  })
})

describe('activityLocalDate', () => {
  test('takes the date portion of startDate', () => {
    expect(activityLocalDate({ startDate: '2026-08-01T06:15:00.000Z' })).toBe('2026-08-01')
  })

  test('returns undefined when startDate is missing', () => {
    expect(activityLocalDate({})).toBeUndefined()
  })
})

describe('appleHealthToSessionFields', () => {
  test('converts using distanceMiles directly when present', () => {
    const fields = appleHealthToSessionFields({
      workoutType: 'Running', startDate: '2026-08-01T06:00:00Z', durationMinutes: 25, distanceMiles: 3.01,
    })
    expect(fields.sessionStatus).toBe('done')
    expect(fields.appleHealthImported).toBe(true)
    expect(fields.appleHealthWorkoutType).toBe('Running')
    expect(fields.actualDistanceMiles).toBe(3.01)
    expect(fields.actualDurationMinutes).toBe(25)
    expect(fields.actualPaceMinPerMile).toBeCloseTo(8.31, 1)
  })

  test('converts distanceKm to miles', () => {
    const fields = appleHealthToSessionFields({ distanceKm: 5, durationMinutes: 30 })
    expect(fields.actualDistanceMiles).toBeCloseTo(3.11, 1)
  })

  test('converts distanceMeters to miles', () => {
    const fields = appleHealthToSessionFields({ distanceMeters: 4828, durationMinutes: 30 })
    expect(fields.actualDistanceMiles).toBeCloseTo(3, 1)
  })

  test('derives duration from startDate/endDate when durationMinutes is missing', () => {
    const fields = appleHealthToSessionFields({
      distanceMiles: 3, startDate: '2026-08-01T06:00:00Z', endDate: '2026-08-01T06:25:00Z',
    })
    expect(fields.actualDurationMinutes).toBe(25)
  })

  test('handles missing distance/duration gracefully', () => {
    const fields = appleHealthToSessionFields({ workoutType: 'Running' })
    expect(fields.actualDistanceMiles).toBeNull()
    expect(fields.actualDurationMinutes).toBeNull()
    expect(fields.actualPaceMinPerMile).toBeNull()
  })
})

describe('findMatchingSession', () => {
  const session = (date, extra = {}) => ({ id: date, date, ...extra })

  test('matches a running workout to the session on the same date', () => {
    const sessions = [session('2026-08-01'), session('2026-08-02')]
    const match = findMatchingSession(sessions, { workoutType: 'Running', startDate: '2026-08-01T06:00:00Z' })
    expect(match?.date).toBe('2026-08-01')
  })

  test('returns null for a non-running workout', () => {
    const sessions = [session('2026-08-01')]
    const match = findMatchingSession(sessions, { workoutType: 'Cycling', startDate: '2026-08-01T06:00:00Z' })
    expect(match).toBeNull()
  })

  test('returns null when the session that date already has appleHealthImported', () => {
    const sessions = [session('2026-08-01', { appleHealthImported: true })]
    const match = findMatchingSession(sessions, { workoutType: 'Running', startDate: '2026-08-01T06:00:00Z' })
    expect(match).toBeNull()
  })

  test('returns null when there is no scheduled session that date', () => {
    const sessions = [session('2026-08-02')]
    const match = findMatchingSession(sessions, { workoutType: 'Running', startDate: '2026-08-01T06:00:00Z' })
    expect(match).toBeNull()
  })
})
