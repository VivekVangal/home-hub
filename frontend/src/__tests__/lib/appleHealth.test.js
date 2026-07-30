import { describe, test, expect } from 'vitest'
import { formatAppleHealthSummary } from '../../lib/appleHealth.js'

describe('formatAppleHealthSummary', () => {
  test('returns null when the session has no matched Apple Health workout', () => {
    expect(formatAppleHealthSummary({ title: 'Long run' })).toBeNull()
  })

  test('formats distance, duration, and pace', () => {
    const summary = formatAppleHealthSummary({
      appleHealthImported: true,
      actualDistanceMiles: 3.01,
      actualDurationMinutes: 25,
      actualPaceMinPerMile: 8.31,
    })
    expect(summary).toBe('3.01 mi in 25:00 (8:19/mi)')
  })

  test('omits the pace parenthetical when pace is missing', () => {
    const summary = formatAppleHealthSummary({
      appleHealthImported: true,
      actualDistanceMiles: 3,
      actualDurationMinutes: 24,
      actualPaceMinPerMile: null,
    })
    expect(summary).toBe('3 mi in 24:00')
  })
})
