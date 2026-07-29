import { describe, test, expect } from 'vitest'
import {
  nextMondayISO,
  computePhases,
  buildTrainingPlan,
  trainingPlanToEvents,
  analyzeGoal,
  predictTime,
  longRunTarget,
  buildDaysMapping,
} from '../../lib/trainingPlan.js'

// Fixed dates so these tests don't depend on "today": 2026-08-03 is a
// Monday, 2026-10-18 (the real race date) is the Sunday 11 weeks later.
const START = '2026-08-03'
const RACE = '2026-10-18'
const HALF_MILES = 13.11

const DAYS = buildDaysMapping(6, 3, 2) // long=Sun, quality=Thu, strength=Wed

function baseProfile(overrides = {}) {
  return {
    raceName: 'Baystate Half Marathon',
    raceDateISO: RACE,
    startISO: START,
    raceDistanceMiles: HALF_MILES,
    targetTimeMinutes: 135, // 2:15 stretch goal
    recentRaceDistanceMiles: HALF_MILES,
    recentRaceTimeMinutes: 170, // 2:50 PR
    currentWeeklyMileage: 8,
    longestRecentRunMiles: 3,
    days: DAYS,
    equipment: 'bodyweight',
    injuryNotes: '',
    ...overrides,
  }
}

describe('nextMondayISO', () => {
  test('rolls forward to the upcoming Monday from a mid-week date', () => {
    expect(nextMondayISO('2026-07-29')).toBe('2026-08-03')
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
  })

  test('gives every phase at least 1 week when there is enough runway for all three', () => {
    const phases = computePhases('2026-08-03', '2026-08-23') // 3 weeks total - the minimum for 3 phases of >= 1 week
    expect(phases.totalWeeks).toBe(3)
    expect(phases.base + phases.build + phases.taper).toBe(phases.totalWeeks)
    expect(Math.min(phases.base, phases.build, phases.taper)).toBeGreaterThanOrEqual(1)
  })

  test('degrades gracefully when there is not enough runway for three full phases', () => {
    // 2 weeks can't give base/build/taper >= 1 week each (that needs >= 3
    // weeks minimum) - taper correctly drops to 0 rather than going negative
    // or stealing weeks that don't exist.
    const phases = computePhases('2026-08-03', '2026-08-16')
    expect(phases.totalWeeks).toBe(2)
    expect(phases.base + phases.build + phases.taper).toBe(phases.totalWeeks)
    expect(phases.base).toBeGreaterThanOrEqual(1)
    expect(phases.build).toBeGreaterThanOrEqual(1)
    expect(phases.taper).toBeGreaterThanOrEqual(0)
  })
})

describe('predictTime (Riegel)', () => {
  test('same distance in, same time out', () => {
    expect(predictTime(13.11, 170, 13.11)).toBeCloseTo(170, 5)
  })

  test('predicts a slower time for a longer target distance', () => {
    expect(predictTime(13.11, 170, 26.22)).toBeGreaterThan(170 * 2) // more than double, not less
  })
})

describe('analyzeGoal', () => {
  test('uses the Riegel prediction when a recent race is given', () => {
    const goal = analyzeGoal({
      raceDistanceMiles: HALF_MILES,
      targetTimeMinutes: 135,
      recentRaceDistanceMiles: HALF_MILES,
      recentRaceTimeMinutes: 170,
      weeksAvailable: 11,
    })
    expect(goal.basis).toBe('recent-race')
    expect(goal.baselineMinutes).toBeCloseTo(170, 5)
    expect(goal.primary.minutes).toBeLessThan(170) // some improvement assumed
    expect(goal.primary.minutes).toBeGreaterThan(135) // but not as fast as the stretch goal
    expect(goal.stretch.minutes).toBe(135) // explicit target, faster than primary, becomes the stretch
  })

  test('falls back to a mileage-based estimate with no recent race', () => {
    const goal = analyzeGoal({
      raceDistanceMiles: HALF_MILES,
      currentWeeklyMileage: 8,
      weeksAvailable: 11,
    })
    expect(goal.basis).toBe('mileage-estimate')
    expect(goal.baselineMinutes).toBeGreaterThan(0)
  })

  test('never assumes more than an 8% improvement, however many weeks are available', () => {
    const goal = analyzeGoal({
      raceDistanceMiles: HALF_MILES,
      recentRaceDistanceMiles: HALF_MILES,
      recentRaceTimeMinutes: 170,
      weeksAvailable: 999,
    })
    expect(goal.improvementPct).toBeLessThanOrEqual(0.08)
  })
})

describe('longRunTarget', () => {
  test('half marathon: caps well under full race distance', () => {
    const target = longRunTarget(HALF_MILES, 3)
    expect(target).toBeGreaterThan(8)
    expect(target).toBeLessThan(HALF_MILES)
  })

  test('5k: long run exceeds the race distance itself (aerobic base)', () => {
    const target = longRunTarget(3.107, 2)
    expect(target).toBeGreaterThan(3.107)
  })
})

describe('buildDaysMapping', () => {
  test('assigns the remaining four days as two easy, two rest', () => {
    const days = buildDaysMapping(6, 3, 2)
    expect(days.long).toEqual([6])
    expect(days.quality).toEqual([3])
    expect(days.strength).toEqual([2])
    expect(days.easy).toHaveLength(2)
    expect(days.rest).toHaveLength(2)
    const all = [...days.long, ...days.quality, ...days.strength, ...days.easy, ...days.rest].sort()
    expect(all).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})

describe('buildTrainingPlan', () => {
  const plan = buildTrainingPlan(baseProfile())

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

  test('the first session is on the start date', () => {
    expect(plan.weeks[0].sessions[0].date).toBe(START)
  })

  test('the last session of the last week is race day itself, using the race name', () => {
    const lastWeek = plan.weeks[plan.weeks.length - 1]
    const raceDay = lastWeek.sessions[6] // Sunday, the configured long-run day
    expect(raceDay.date).toBe(RACE)
    expect(raceDay.title).toBe('Baystate Half Marathon')
  })

  test('quality workouts only turn into tempo/intervals once base phase is over', () => {
    const baseWeekQuality = plan.weeks[0].sessions[3] // Thursday
    const buildWeekQuality = plan.weeks[4].sessions[3]
    expect(baseWeekQuality.title).toBe('Easy run + strides')
    expect(buildWeekQuality.title).toBe('Quality: tempo/intervals')
  })

  test('respects a custom day assignment (strength on the configured day)', () => {
    expect(plan.weeks[0].sessions[2].title).toBe('Strength + stretch') // Wednesday, per DAYS
  })
})

describe('trainingPlanToEvents', () => {
  test('flattens every session into an owned, tagged event', () => {
    const plan = buildTrainingPlan(baseProfile())
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
