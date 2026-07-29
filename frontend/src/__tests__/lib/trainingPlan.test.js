import { describe, test, expect } from 'vitest'
import {
  nextMondayISO,
  computePhases,
  buildTrainingPlan,
  trainingPlanToEvents,
  RACE_NAME,
} from '../../lib/trainingPlan.js'

// Fixed dates so these tests don't depend on "today": 2026-08-03 is a
// Monday, 2026-10-18 (the real race date) is the Sunday 11 weeks later.
const START = '2026-08-03'
const RACE = '2026-10-18'

describe('nextMondayISO', () => {
  test('rolls forward to the upcoming Monday from a mid-week date', () => {
    expect(nextMondayISO('2026-07-29')).toBe('2026-08-03') // Wednesday -> next Monday
  })

  test('returns the same date if it is already a Monday', () => {
    expect(nextMondayISO('2026-08-03')).toBe('2026-08-03')
  })
})

describe('computePhases', () => {
  test('splits 11 available weeks into base/build/taper, each >= 1 week', () => {
    const phases = computePhases(START, RACE)
    expect(phases.totalWeeks).toBe(11)
    expect(phases.base).toBe(4)
    expect(phases.build).toBe(5)
    expect(phases.taper).toBe(2)
    expect(phases.base + phases.build + phases.taper).toBe(phases.totalWeeks)
  })

  test('never produces a phase shorter than 1 week, even on a very short runway', () => {
    const phases = computePhases('2026-08-03', '2026-08-16') // 2 weeks total
    expect(phases.totalWeeks).toBe(2)
    expect(phases.base).toBeGreaterThanOrEqual(1)
    expect(phases.build).toBeGreaterThanOrEqual(1)
    expect(phases.taper).toBeGreaterThanOrEqual(1)
    expect(phases.base + phases.build + phases.taper).toBe(phases.totalWeeks)
  })
})

describe('buildTrainingPlan', () => {
  const plan = buildTrainingPlan(START, RACE)

  test('produces one week per computed phase week, 7 sessions each', () => {
    expect(plan.weeks).toHaveLength(11)
    plan.weeks.forEach((w) => expect(w.sessions).toHaveLength(7))
  })

  test('assigns phases in order: base weeks first, then build, then taper', () => {
    expect(plan.weeks[0].phase).toBe('base')
    expect(plan.weeks[3].phase).toBe('base')
    expect(plan.weeks[4].phase).toBe('build')
    expect(plan.weeks[8].phase).toBe('build')
    expect(plan.weeks[9].phase).toBe('taper')
    expect(plan.weeks[10].phase).toBe('taper')
  })

  test('the very first session is on the start date, Monday', () => {
    expect(plan.weeks[0].sessions[0].date).toBe(START)
    expect(plan.weeks[0].sessions[0].title).toMatch(/rest/i)
  })

  test('the last session of the last week is race day itself', () => {
    const lastWeek = plan.weeks[plan.weeks.length - 1]
    const raceDay = lastWeek.sessions[6]
    expect(raceDay.date).toBe(RACE)
    expect(raceDay.title).toBe(RACE_NAME)
  })

  test('quality workouts only appear once base phase is over', () => {
    const baseWeekTitles = plan.weeks[0].sessions.map((s) => s.title)
    const buildWeekTitles = plan.weeks[4].sessions.map((s) => s.title)
    expect(baseWeekTitles).not.toContain('Quality: tempo/intervals')
    expect(buildWeekTitles).toContain('Quality: tempo/intervals')
  })
})

describe('trainingPlanToEvents', () => {
  test('flattens every session into an owned, tagged event', () => {
    const plan = buildTrainingPlan(START, RACE)
    const events = trainingPlanToEvents(plan, 'user-123')

    expect(events).toHaveLength(11 * 7)
    events.forEach((e) => {
      expect(e.owner).toBe('user-123')
      expect(e.trainingPlan).toBe(true)
      expect(e.date).toBeTruthy()
      expect(e.title).toBeTruthy()
    })
  })
})
