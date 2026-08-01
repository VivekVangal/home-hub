import { describe, test, expect } from 'vitest'
import { buildStravaAuthorizeUrl, formatStravaSummary } from '../../lib/strava.js'

describe('buildStravaAuthorizeUrl', () => {
  test('builds a Strava authorize URL with the given redirect and a real, valid Strava scope', () => {
    const url = buildStravaAuthorizeUrl('https://home-hub-family-dev.web.app/training')
    expect(url).toMatch(/^https:\/\/www\.strava\.com\/oauth\/authorize\?/)
    expect(url).toContain('response_type=code')
    // Verified directly against Strava's live OAuth endpoint (curl'd the
    // built URL) — "activity:read_only" is not a real Strava scope and
    // Strava rejects it with a 400 before ever showing a login page; the
    // valid ones are read/read_all/profile:read_all/profile:write/
    // activity:read/activity:read_all/activity:write.
    expect(url).toContain('scope=activity%3Aread_all')
    expect(url).toContain(encodeURIComponent('https://home-hub-family-dev.web.app/training'))
  })
})

describe('formatStravaSummary', () => {
  test('returns null when the session has no matched Strava activity', () => {
    expect(formatStravaSummary({ title: 'Long run' })).toBeNull()
  })

  test('formats distance, duration, and pace', () => {
    const summary = formatStravaSummary({
      stravaActivityId: '123',
      actualDistanceMiles: 3.01,
      actualDurationMinutes: 25,
      actualPaceMinPerMile: 8.31,
    })
    expect(summary).toBe('3.01 mi in 25:00 (8:19/mi)')
  })

  test('omits the pace parenthetical when pace is missing', () => {
    const summary = formatStravaSummary({
      stravaActivityId: '123',
      actualDistanceMiles: 3,
      actualDurationMinutes: 24,
      actualPaceMinPerMile: null,
    })
    expect(summary).toBe('3 mi in 24:00')
  })
})
