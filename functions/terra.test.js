import { describe, test, expect } from 'vitest'
import {
  activityLocalDate, matchActivitiesToSessions, activityToSessionFields,
  computeTerraSignature, verifyTerraWebhookSignature,
} from './terra.js'

describe('activityLocalDate', () => {
  test('takes the date portion of metadata.start_time', () => {
    expect(activityLocalDate({ metadata: { start_time: '2026-08-01T06:15:00.000Z' } })).toBe('2026-08-01')
  })
})

describe('matchActivitiesToSessions', () => {
  const session = (date, extra = {}) => ({ id: date, date, ...extra })
  const activity = (date, overrides = {}) => ({
    metadata: { type: 8, start_time: `${date}T06:00:00Z`, end_time: `${date}T06:25:00Z`, summary_id: `sid-${date}`, name: 'Morning Run' },
    distance_data: { summary: { distance_meters: 4828 } },
    active_durations_data: { activity_seconds: 1500 },
    ...overrides,
  })

  test('matches a running-type activity to the session on the same date', () => {
    const sessions = [session('2026-08-01'), session('2026-08-02')]
    const activities = [activity('2026-08-01')]
    const matches = matchActivitiesToSessions(activities, sessions)
    expect(matches).toHaveLength(1)
    expect(matches[0].session.date).toBe('2026-08-01')
  })

  test('ignores non-running activity types', () => {
    const sessions = [session('2026-08-01')]
    const activities = [activity('2026-08-01', { metadata: { ...activity('2026-08-01').metadata, type: 1 } })] // Biking
    expect(matchActivitiesToSessions(activities, sessions)).toHaveLength(0)
  })

  test('treats jogging/treadmill/indoor-running types as running too', () => {
    const sessions = [session('2026-08-01'), session('2026-08-02'), session('2026-08-03')]
    const activities = [
      activity('2026-08-01', { metadata: { ...activity('2026-08-01').metadata, type: 56 } }), // Jogging
      activity('2026-08-02', { metadata: { ...activity('2026-08-02').metadata, type: 58 } }), // Treadmill Running
      activity('2026-08-03', { metadata: { ...activity('2026-08-03').metadata, type: 133 } }), // Indoor Running
    ]
    expect(matchActivitiesToSessions(activities, sessions)).toHaveLength(3)
  })

  test('skips sessions that already have a terraActivityId', () => {
    const sessions = [session('2026-08-01', { terraActivityId: 'already-set' })]
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
    const activities = [activity('2026-08-01'), activity('2026-08-01', { metadata: { ...activity('2026-08-01').metadata, summary_id: 'second' } })]
    const matches = matchActivitiesToSessions(activities, sessions)
    expect(matches).toHaveLength(1)
    expect(matches[0].activity.metadata.summary_id).toBe('sid-2026-08-01')
  })
})

describe('activityToSessionFields', () => {
  test('converts a Terra activity into event fields, using activity_seconds when present', () => {
    const fields = activityToSessionFields({
      metadata: { type: 8, summary_id: 'sid-999', name: 'Tempo run', start_time: '2026-08-01T06:00:00Z', end_time: '2026-08-01T06:30:00Z' },
      distance_data: { summary: { distance_meters: 4828 } },
      active_durations_data: { activity_seconds: 1500 },
    })
    expect(fields.sessionStatus).toBe('done')
    expect(fields.terraActivityId).toBe('sid-999')
    expect(fields.terraActivityName).toBe('Tempo run')
    expect(fields.actualDistanceMiles).toBeCloseTo(3, 1)
    expect(fields.actualDurationMinutes).toBe(25)
    expect(fields.actualPaceMinPerMile).toBeCloseTo(8.33, 1)
  })

  test('falls back to start/end time difference when activity_seconds is missing', () => {
    const fields = activityToSessionFields({
      metadata: { type: 8, summary_id: 'sid-998', start_time: '2026-08-01T06:00:00Z', end_time: '2026-08-01T06:20:00Z' },
      distance_data: { summary: { distance_meters: 3218.7 } },
    })
    expect(fields.actualDurationMinutes).toBe(20)
  })

  test('handles missing distance/duration gracefully', () => {
    const fields = activityToSessionFields({ metadata: { type: 8, summary_id: 'sid-997' } })
    expect(fields.actualDistanceMiles).toBeNull()
    expect(fields.actualDurationMinutes).toBeNull()
    expect(fields.actualPaceMinPerMile).toBeNull()
  })
})

describe('Terra webhook signature verification', () => {
  const secret = 'test-signing-secret'
  const body = JSON.stringify({ type: 'activity', data: [] })

  test('accepts a correctly computed signature within the time tolerance', () => {
    const timestamp = 1000000
    const signature = computeTerraSignature(timestamp, body, secret)
    const header = `t=${timestamp},v1=${signature}`
    expect(verifyTerraWebhookSignature(body, header, secret, { nowSeconds: 1000010 })).toBe(true)
  })

  test('rejects a tampered body', () => {
    const timestamp = 1000000
    const signature = computeTerraSignature(timestamp, body, secret)
    const header = `t=${timestamp},v1=${signature}`
    const tamperedBody = JSON.stringify({ type: 'activity', data: [{ hacked: true }] })
    expect(verifyTerraWebhookSignature(tamperedBody, header, secret, { nowSeconds: 1000010 })).toBe(false)
  })

  test('rejects a signature outside the tolerance window (replay protection)', () => {
    const timestamp = 1000000
    const signature = computeTerraSignature(timestamp, body, secret)
    const header = `t=${timestamp},v1=${signature}`
    expect(verifyTerraWebhookSignature(body, header, secret, { nowSeconds: 1000000 + 400, toleranceSeconds: 300 })).toBe(false)
  })

  test('rejects a missing signature header', () => {
    expect(verifyTerraWebhookSignature(body, null, secret)).toBe(false)
  })

  test('rejects the wrong secret', () => {
    const timestamp = 1000000
    const signature = computeTerraSignature(timestamp, body, 'a-different-secret')
    const header = `t=${timestamp},v1=${signature}`
    expect(verifyTerraWebhookSignature(body, header, secret, { nowSeconds: 1000010 })).toBe(false)
  })
})
