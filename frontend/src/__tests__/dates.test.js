import { describe, test, expect } from 'vitest'
import {
  toISODate,
  todayISO,
  getWeekStart,
  getWeekDays,
  formatDisplayDate,
  formatShortDate,
  formatDayLabel,
  isPastDue,
  addDaysISO,
} from '../utils/dates.js'

describe('toISODate / todayISO', () => {
  test('formats a Date object as yyyy-MM-dd using local components', () => {
    const d = new Date(2026, 5, 15) // June 15, 2026 (month is 0-indexed)
    expect(toISODate(d)).toBe('2026-06-15')
  })

  test('pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5) // Jan 5, 2026
    expect(toISODate(d)).toBe('2026-01-05')
  })

  test('todayISO matches the current local date', () => {
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(todayISO()).toBe(expected)
  })
})

describe('getWeekStart', () => {
  test('always returns a Monday', () => {
    const someDate = new Date(2026, 0, 7)
    const weekStartISO = getWeekStart(someDate)
    const weekStartDate = new Date(`${weekStartISO}T00:00:00`)
    expect(weekStartDate.getDay()).toBe(1) // 1 = Monday
  })

  test('the returned Monday falls within 0-6 days before the input date', () => {
    const someDate = new Date(2026, 3, 22)
    const weekStartISO = getWeekStart(someDate)
    const weekStartDate = new Date(`${weekStartISO}T00:00:00`)
    const diffDays = Math.round((someDate - weekStartDate) / 86400000)
    expect(diffDays).toBeGreaterThanOrEqual(0)
    expect(diffDays).toBeLessThanOrEqual(6)
  })

  test('a date that is already a Monday returns itself', () => {
    // 2026-01-05 is a Monday.
    const monday = new Date(2026, 0, 5)
    expect(getWeekStart(monday)).toBe('2026-01-05')
  })
})

describe('getWeekDays', () => {
  test('returns 7 consecutive ISO dates starting at weekStart', () => {
    const days = getWeekDays('2026-01-05')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-01-05')
    expect(days[6]).toBe('2026-01-11')
  })

  test('handles month boundaries', () => {
    const days = getWeekDays('2026-01-26')
    expect(days).toEqual([
      '2026-01-26', '2026-01-27', '2026-01-28', '2026-01-29',
      '2026-01-30', '2026-01-31', '2026-02-01',
    ])
  })
})

describe('addDaysISO', () => {
  test('adds positive days across a month boundary', () => {
    expect(addDaysISO('2026-01-28', 5)).toBe('2026-02-02')
  })

  test('subtracts days across a year boundary', () => {
    expect(addDaysISO('2026-01-05', -7)).toBe('2025-12-29')
  })

  test('zero days returns the same date', () => {
    expect(addDaysISO('2026-06-15', 0)).toBe('2026-06-15')
  })
})

describe('formatDisplayDate / formatShortDate / formatDayLabel', () => {
  test('formatDisplayDate produces "Day, Mon D" shape', () => {
    expect(formatDisplayDate('2026-01-05')).toMatch(/^[A-Za-z]{3}, [A-Za-z]{3} \d{1,2}$/)
  })

  test('formatShortDate produces "Mon D" shape', () => {
    expect(formatShortDate('2026-01-05')).toMatch(/^[A-Za-z]{3} \d{1,2}$/)
  })

  test('formatDayLabel produces a full weekday name', () => {
    // 2026-01-05 is a Monday.
    expect(formatDayLabel('2026-01-05')).toBe('Monday')
  })
})

describe('isPastDue', () => {
  test('yesterday is past due', () => {
    expect(isPastDue(addDaysISO(todayISO(), -1))).toBe(true)
  })

  test('today is not past due', () => {
    expect(isPastDue(todayISO())).toBe(false)
  })

  test('tomorrow is not past due', () => {
    expect(isPastDue(addDaysISO(todayISO(), 1))).toBe(false)
  })
})
