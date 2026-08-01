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
  computeTrainingAdjustment,
  computeVdot,
  vdotZonePace,
  vdotTrainingPaces,
  DISTANCES,
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

describe('computeVdot', () => {
  test('matches the well-known reference point: a 20:00 5k is approximately VDOT 50', () => {
    // Published Daniels VDOT tables list VDOT 50 as almost exactly a 19:57
    // 5k, so 20:00 should land just a hair under 50.
    expect(computeVdot(DISTANCES['5k'], 20)).toBeCloseTo(50, 0)
  })

  test('a faster time at the same distance produces a higher VDOT', () => {
    const slower = computeVdot(DISTANCES['5k'], 22)
    const faster = computeVdot(DISTANCES['5k'], 18)
    expect(faster).toBeGreaterThan(slower)
  })
})

describe('vdotZonePace', () => {
  const vdot = computeVdot(DISTANCES['5k'], 20) // ~50

  test('orders zone paces from slowest to fastest: easy > marathon > threshold > interval > repetition', () => {
    const easy = vdotZonePace(vdot, 'easy')
    const marathon = vdotZonePace(vdot, 'marathon')
    const threshold = vdotZonePace(vdot, 'threshold')
    const interval = vdotZonePace(vdot, 'interval')
    const repetition = vdotZonePace(vdot, 'repetition')
    // Paces are minutes/mile, so "faster" means a smaller number.
    expect(easy).toBeGreaterThan(marathon)
    expect(marathon).toBeGreaterThan(threshold)
    expect(threshold).toBeGreaterThan(interval)
    expect(interval).toBeGreaterThan(repetition)
  })

  test('a higher VDOT produces faster paces in the same zone', () => {
    const fitter = computeVdot(DISTANCES['5k'], 16)
    expect(vdotZonePace(fitter, 'threshold')).toBeLessThan(vdotZonePace(vdot, 'threshold'))
  })
})

describe('vdotTrainingPaces', () => {
  test('returns the vdot score plus all five zone paces, formatted', () => {
    const result = vdotTrainingPaces(DISTANCES['5k'], 20)
    expect(result.vdot).toBeCloseTo(50, 0)
    expect(Object.keys(result.paces).sort()).toEqual(['easy', 'interval', 'marathon', 'repetition', 'threshold'])
    Object.values(result.paces).forEach((p) => {
      expect(p.minPerMile).toBeGreaterThan(0)
      expect(p.pace).toMatch(/^\d+:\d{2}\/mi$/)
    })
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

  test('exposes the VDOT-derived paces at the plan level when a recent race is given', () => {
    expect(plan.vdot).not.toBeNull()
    expect(plan.vdot.paces.threshold.pace).toMatch(/^\d+:\d{2}\/mi$/)
  })

  test('build-phase quality sessions cite threshold/interval pace instead of the blended stretch pace', () => {
    const buildWeekQuality = plan.weeks[4].sessions[3]
    expect(buildWeekQuality.notes).toContain(`threshold pace (${plan.vdot.paces.threshold.pace})`)
    expect(buildWeekQuality.notes).toContain(`interval pace (${plan.vdot.paces.interval.pace})`)
    expect(buildWeekQuality.notes).not.toContain('stretch pace')
  })

  test('easy and long run sessions cite the VDOT easy pace', () => {
    const baseWeekEasyPlusStrides = plan.weeks[0].sessions[3] // Thursday, base phase
    const longRun = plan.weeks[0].sessions[6] // Sunday, per DAYS
    expect(baseWeekEasyPlusStrides.notes).toContain(`aim slower than ${plan.vdot.paces.easy.pace}`)
    expect(longRun.notes).toContain(`aim slower than ${plan.vdot.paces.easy.pace}`)
  })

  test('falls back to the old stretch-pace/generic wording with no recent race result', () => {
    const noRacePlan = buildTrainingPlan(baseProfile({ recentRaceDistanceMiles: null, recentRaceTimeMinutes: null }))
    expect(noRacePlan.vdot).toBeNull()
    const buildWeekQuality = noRacePlan.weeks[4].sessions[3]
    expect(buildWeekQuality.notes).toContain(`quality miles at stretch pace (${noRacePlan.goal.stretch.pace})`)
    const longRun = noRacePlan.weeks[0].sessions[6]
    expect(longRun.notes).toContain('easy pace — slower than race pace on purpose')
    expect(longRun.notes).not.toContain('aim slower than')
  })
})

describe('computeTrainingAdjustment', () => {
  const GOAL_PACE = 10 // min/mi, for readability in these fixtures

  test('returns a neutral adjustment when nothing has been logged yet', () => {
    const adjustment = computeTrainingAdjustment([], GOAL_PACE)
    expect(adjustment).toEqual({ mileageMultiplier: 1, paceAdjustmentPct: 0, skipRate: 0, sessionsConsidered: 0 })
  })

  test('ignores sessions with no sessionStatus (future/unscheduled)', () => {
    const sessions = [{ date: '2026-08-01' }, { date: '2026-08-02' }]
    expect(computeTrainingAdjustment(sessions, GOAL_PACE).sessionsConsidered).toBe(0)
  })

  test('slows the mileage ramp when more than half of logged sessions were skipped', () => {
    const sessions = [
      { sessionStatus: 'skipped' }, { sessionStatus: 'skipped' }, { sessionStatus: 'skipped' }, { sessionStatus: 'done' },
    ]
    const adjustment = computeTrainingAdjustment(sessions, GOAL_PACE)
    expect(adjustment.skipRate).toBe(0.75)
    expect(adjustment.mileageMultiplier).toBe(0.75)
  })

  test('slows the ramp less aggressively between a third and a half skipped', () => {
    const sessions = [{ sessionStatus: 'skipped' }, { sessionStatus: 'done' }, { sessionStatus: 'done' }]
    const adjustment = computeTrainingAdjustment(sessions, GOAL_PACE)
    expect(adjustment.skipRate).toBeCloseTo(1 / 3, 5)
    expect(adjustment.mileageMultiplier).toBe(1) // exactly 1/3 doesn't cross the "> 1/3" threshold
  })

  test('leaves the ramp untouched when compliance is good', () => {
    const sessions = [{ sessionStatus: 'done' }, { sessionStatus: 'done' }, { sessionStatus: 'skipped' }]
    expect(computeTrainingAdjustment(sessions, GOAL_PACE).mileageMultiplier).toBe(1)
  })

  test('nudges the goal faster when logged runs consistently beat goal pace', () => {
    const sessions = [
      { sessionStatus: 'done', actualPaceMinPerMile: 9.0 },
      { sessionStatus: 'done', actualPaceMinPerMile: 9.2 },
    ]
    const adjustment = computeTrainingAdjustment(sessions, GOAL_PACE)
    expect(adjustment.paceAdjustmentPct).toBeLessThan(0)
  })

  test('nudges the goal slower when logged runs are consistently much slower than goal pace', () => {
    const sessions = [
      { sessionStatus: 'done', actualPaceMinPerMile: 13.5 },
      { sessionStatus: 'done', actualPaceMinPerMile: 14.0 },
    ]
    const adjustment = computeTrainingAdjustment(sessions, GOAL_PACE)
    expect(adjustment.paceAdjustmentPct).toBeGreaterThan(0)
  })

  test('leaves pace untouched with only one logged pace data point (not enough signal)', () => {
    const sessions = [{ sessionStatus: 'done', actualPaceMinPerMile: 9.0 }]
    expect(computeTrainingAdjustment(sessions, GOAL_PACE).paceAdjustmentPct).toBe(0)
  })

  test('leaves pace untouched when actual pace is close to goal pace (neither clearly faster nor slower)', () => {
    const sessions = [
      { sessionStatus: 'done', actualPaceMinPerMile: 10.1 },
      { sessionStatus: 'done', actualPaceMinPerMile: 10.2 },
    ]
    expect(computeTrainingAdjustment(sessions, GOAL_PACE).paceAdjustmentPct).toBe(0)
  })
})

describe('buildTrainingPlan dynamic adjustment', () => {
  test('with no recentSessions, behaves exactly like the old static plan (no adjustment)', () => {
    const plan = buildTrainingPlan(baseProfile())
    expect(plan.adjustment).toEqual({ mileageMultiplier: 1, paceAdjustmentPct: 0, skipRate: 0, sessionsConsidered: 0 })
  })

  test('a heavily-skipped recent stretch produces a smaller long run than the same plan with good compliance', () => {
    const skippedHistory = Array.from({ length: 4 }, () => ({ sessionStatus: 'skipped' }))
    const compliantHistory = Array.from({ length: 4 }, () => ({ sessionStatus: 'done' }))

    const skippedPlan = buildTrainingPlan(baseProfile(), skippedHistory)
    const compliantPlan = buildTrainingPlan(baseProfile(), compliantHistory)

    expect(skippedPlan.targetLongRun).toBeLessThan(compliantPlan.targetLongRun)
    expect(skippedPlan.adjustment.mileageMultiplier).toBeLessThan(1)
    expect(compliantPlan.adjustment.mileageMultiplier).toBe(1)
  })

  test('consistently fast logged runs produce a faster stretch goal than the unadjusted plan', () => {
    const unadjusted = buildTrainingPlan(baseProfile())
    const goalPace = unadjusted.goal.stretch.minutes / HALF_MILES

    const fastHistory = [
      { sessionStatus: 'done', actualPaceMinPerMile: goalPace * 0.9 },
      { sessionStatus: 'done', actualPaceMinPerMile: goalPace * 0.92 },
    ]
    const adjustedPlan = buildTrainingPlan(baseProfile(), fastHistory)

    expect(adjustedPlan.goal.stretch.minutes).toBeLessThan(unadjusted.goal.stretch.minutes)
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
