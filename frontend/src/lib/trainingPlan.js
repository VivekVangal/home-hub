// ---------------------------------------------------------------------------
// Race-training plan generator — general-purpose, not tied to any one race.
// Every family member can build their own (different race, distance, date,
// goal), driven entirely by the answers in TrainingPlanForm.jsx. Pure
// functions only (no Firestore/db.js calls) so this is easy to unit test;
// TrainingPage.jsx is what actually persists the output via db.js.
// ---------------------------------------------------------------------------

import { addDaysISO, toISODate } from '../utils/dates.js'
import { parseISO, startOfWeek, addWeeks, differenceInCalendarWeeks } from 'date-fns'

// Common race distances, in miles, for the form's dropdown.
export const DISTANCES = {
  '5k': 3.107,
  '10k': 6.214,
  '15k': 9.321,
  '10mile': 10,
  half: 13.11,
  full: 26.22,
}

// Real, defensible defaults for this household's actual race — prefill the
// form with these rather than making everyone start from a blank sheet.
export const DEFAULT_PROFILE = {
  raceName: 'Baystate Half Marathon',
  raceDateISO: '2026-10-18',
  raceDistanceMiles: DISTANCES.half,
  targetTimeMinutes: 135, // sub-2:15 stretch goal
  recentRaceDistanceMiles: DISTANCES.half,
  recentRaceTimeMinutes: 170, // 2:50 half PR
  currentWeeklyMileage: 8,
  longestRecentRunMiles: 3,
  equipment: 'bodyweight',
  injuryNotes: '',
  days: { rest: [0, 4], easy: [1, 5], strength: [2], quality: [3], long: [6] }, // Mon=0 .. Sun=6
}

const PHASE_SHARE = { base: 4 / 12, build: 5 / 12, taper: 3 / 12 }

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function weekStartISO(isoDate) {
  return toISODate(startOfWeek(parseISO(isoDate), { weekStartsOn: 1 }))
}

// The next Monday on/after `fromISO` — training always starts on a Monday.
export function nextMondayISO(fromISO) {
  const ws = weekStartISO(fromISO)
  return ws === fromISO ? ws : toISODate(addWeeks(parseISO(ws), 1))
}

// Splits the available weeks into base/build/taper, each getting at least
// one week even on a very short runway.
export function computePhases(startISO, raceISO) {
  const totalWeeks = Math.max(
    1,
    differenceInCalendarWeeks(parseISO(raceISO), parseISO(startISO), { weekStartsOn: 1 }) + 1
  )
  let base = Math.max(1, Math.round(totalWeeks * PHASE_SHARE.base))
  let build = Math.max(1, Math.round(totalWeeks * PHASE_SHARE.build))
  let taper = totalWeeks - base - build
  if (taper < 1) {
    const shortfall = 1 - taper
    const fromBuild = Math.min(shortfall, build - 1)
    build -= fromBuild
    const stillShort = shortfall - fromBuild
    base = Math.max(1, base - stillShort)
    taper = totalWeeks - base - build
  }
  return { totalWeeks, base, build, taper }
}

function phaseForWeek(weekIndex, phases) {
  if (weekIndex < phases.base) return 'base'
  if (weekIndex < phases.base + phases.build) return 'build'
  return 'taper'
}

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

// ---------------------------------------------------------------------------
// Goal analysis — Riegel's race-time-equivalence formula (T2 = T1 *
// (D2/D1)^1.06) is a long-established, widely used way to estimate a
// runner's expected time at one distance from a real result at another. If
// no recent race is given, falls back to a much rougher estimate from
// current weekly mileage — explicitly labeled as such, since it's a guess,
// not a prediction.
// ---------------------------------------------------------------------------

export function predictTime(knownDistanceMiles, knownTimeMinutes, targetDistanceMiles) {
  return knownTimeMinutes * Math.pow(targetDistanceMiles / knownDistanceMiles, 1.06)
}

export function fmtMinutesAsTime(totalMinutes) {
  const wholeSeconds = Math.round(totalMinutes * 60)
  const h = Math.floor(wholeSeconds / 3600)
  const m = Math.floor((wholeSeconds % 3600) / 60)
  const s = wholeSeconds % 60
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function fmtPace(totalMinutes, distanceMiles) {
  const perMile = totalMinutes / distanceMiles
  const m = Math.floor(perMile)
  const s = Math.round((perMile - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}/mi`
}

// Returns { basis, baselineMinutes, improvementPct, primary: {minutes, time, pace}, stretch: {...} }
export function analyzeGoal({
  raceDistanceMiles,
  targetTimeMinutes,
  recentRaceDistanceMiles,
  recentRaceTimeMinutes,
  currentWeeklyMileage,
  weeksAvailable,
}) {
  let baselineMinutes
  let basis
  if (recentRaceDistanceMiles && recentRaceTimeMinutes) {
    baselineMinutes = predictTime(recentRaceDistanceMiles, recentRaceTimeMinutes, raceDistanceMiles)
    basis = 'recent-race'
  } else {
    // Rough fallback when there's no recent race result to extrapolate
    // from: more weekly volume relative to race distance nudges the
    // estimate faster, within a conservative 10-13 min/mi band. This is a
    // starting point to plan around, not a real prediction.
    const ratio = currentWeeklyMileage ? currentWeeklyMileage / raceDistanceMiles : 1
    const estPace = 13 - Math.min(3, ratio * 0.6)
    baselineMinutes = estPace * raceDistanceMiles
    basis = 'mileage-estimate'
  }

  // Modest, conservative improvement assumption for a structured training
  // block: more available weeks supports a bit more improvement, capped at
  // 8% so this never promises something training science wouldn't back.
  const improvementPct = Math.min(0.08, 0.015 * Math.sqrt(weeksAvailable || 1))
  const primaryMinutes = baselineMinutes * (1 - improvementPct)

  let stretchMinutes = primaryMinutes
  if (targetTimeMinutes && targetTimeMinutes < primaryMinutes) {
    stretchMinutes = targetTimeMinutes
  }

  return {
    basis,
    baselineMinutes,
    improvementPct,
    primary: {
      minutes: primaryMinutes,
      time: fmtMinutesAsTime(primaryMinutes),
      pace: fmtPace(primaryMinutes, raceDistanceMiles),
    },
    stretch: {
      minutes: stretchMinutes,
      time: fmtMinutesAsTime(stretchMinutes),
      pace: fmtPace(stretchMinutes, raceDistanceMiles),
    },
  }
}

// ---------------------------------------------------------------------------
// Dynamic adjustment — instead of a static pre-generated schedule that never
// reacts to how training is actually going, "Regenerate remaining plan"
// (see TrainingPage.jsx) passes in the last few weeks of logged sessions so
// upcoming weeks can nudge based on real compliance and performance:
//   - Skipping a third or more of recent sessions slows the mileage ramp
//     rather than blindly climbing regardless of what actually happened.
//     This only ever slows the ramp, never speeds it up — consistency is
//     what should be rewarded, not pushing someone to do even more.
//   - Running logged sessions consistently at or faster than the stretch
//     goal's pace nudges that goal a little faster (it was too conservative);
//     consistently much slower nudges it a little slower. Capped at 3%
//     either way — this nudges analyzeGoal's result, it doesn't replace it.
// Pure and testable with a fixed list of fake sessions — no "current date"
// or Firestore dependency here, same as the rest of this module.
// ---------------------------------------------------------------------------

const SKIP_RATE_SLOWDOWN_THRESHOLDS = [
  { min: 0.5, multiplier: 0.75 },
  { min: 1 / 3, multiplier: 0.9 },
]
const PACE_ADJUSTMENT_PCT = 0.03
const FASTER_THAN_GOAL_RATIO = 0.97 // avg actual pace <= 97% of goal pace -> running faster than the goal
const MUCH_SLOWER_THAN_GOAL_RATIO = 1.25 // avg actual pace >= 125% of goal pace -> struggling to hold it

// `recentSessions` should be trainingPlan events from roughly the last 2-3
// weeks that have already happened (done or skipped) — future/unscheduled
// sessions don't carry a sessionStatus and are ignored here even if passed
// in by mistake. `goalStretchPaceMinPerMile` is the current stretch goal's
// pace, in minutes per mile, for comparison against actual logged paces.
export function computeTrainingAdjustment(recentSessions, goalStretchPaceMinPerMile) {
  const logged = (recentSessions || []).filter((s) => s.sessionStatus === 'done' || s.sessionStatus === 'skipped')
  if (logged.length === 0) {
    return { mileageMultiplier: 1, paceAdjustmentPct: 0, skipRate: 0, sessionsConsidered: 0 }
  }

  const skipRate = logged.filter((s) => s.sessionStatus === 'skipped').length / logged.length
  const threshold = SKIP_RATE_SLOWDOWN_THRESHOLDS.find((t) => skipRate > t.min)
  const mileageMultiplier = threshold ? threshold.multiplier : 1

  const withPace = logged.filter((s) => s.sessionStatus === 'done' && s.actualPaceMinPerMile != null)
  let paceAdjustmentPct = 0
  if (withPace.length >= 2 && goalStretchPaceMinPerMile) {
    const avgPace = withPace.reduce((sum, s) => sum + s.actualPaceMinPerMile, 0) / withPace.length
    const ratio = avgPace / goalStretchPaceMinPerMile
    if (ratio <= FASTER_THAN_GOAL_RATIO) paceAdjustmentPct = -PACE_ADJUSTMENT_PCT
    else if (ratio >= MUCH_SLOWER_THAN_GOAL_RATIO) paceAdjustmentPct = PACE_ADJUSTMENT_PCT
  }

  return { mileageMultiplier, paceAdjustmentPct, skipRate, sessionsConsidered: logged.length }
}

// ---------------------------------------------------------------------------
// Long-run progression — target peak long run scales with race distance:
// shorter races (5k/10k) benefit from a long run noticeably longer than the
// race itself (aerobic base); half/full marathon long runs cap well under
// the full distance (70-85%) to manage injury risk. Never demands more than
// a reasonable jump from the runner's current longest run.
// ---------------------------------------------------------------------------

export function longRunTarget(raceDistanceMiles, longestRecentRunMiles) {
  const base = longestRecentRunMiles || raceDistanceMiles * 0.25
  let guideline
  if (raceDistanceMiles <= 6.5) guideline = raceDistanceMiles * 1.3
  else if (raceDistanceMiles <= 14) guideline = raceDistanceMiles * 0.85
  else guideline = raceDistanceMiles * 0.7
  return Math.max(guideline, base + 2)
}

// ---------------------------------------------------------------------------
// Weekly session generation
// ---------------------------------------------------------------------------

function offsetKind(days, offset) {
  for (const [kind, offsets] of Object.entries(days)) {
    if (offsets.includes(offset)) return kind
  }
  return 'rest'
}

function easyMilesForWeek(weekIndex, phases, mileageMultiplier = 1) {
  // Easy-run mileage ramps gently alongside the long run, capped modestly.
  const phase = phaseForWeek(weekIndex, phases)
  const base = phase === 'taper' ? 3 : phase === 'base' ? 3 : 4
  return Math.max(2, Math.round(base * mileageMultiplier))
}

function longRunMilesForWeek(weekIndex, phases, longestRecentRunMiles, targetLongRun) {
  const { base, build, taper } = phases
  const phase = phaseForWeek(weekIndex, phases)
  const buildPeak = targetLongRun
  if (phase === 'base') {
    return Math.round(lerp(longestRecentRunMiles || 3, Math.min(6, buildPeak), base <= 1 ? 1 : weekIndex / (base - 1)))
  }
  if (phase === 'build') {
    const i = weekIndex - base
    return Math.round(lerp(Math.min(6, buildPeak), buildPeak, build <= 1 ? 1 : i / (build - 1)))
  }
  const i = weekIndex - base - build
  return Math.round(lerp(Math.max(buildPeak * 0.7, 4), 2, taper <= 1 ? 1 : i / (taper - 1)))
}

function sessionForKind(kind, { weekIndex, phases, goal, longestRecentRunMiles, targetLongRun, equipment, mileageMultiplier }) {
  const phase = phaseForWeek(weekIndex, phases)
  switch (kind) {
    case 'rest':
      return { title: 'Rest / mobility', notes: '20 min easy walk or mobility work. Full rest is fine too.' }
    case 'strength':
      return {
        title: 'Strength + stretch',
        notes: `Lower body + core, 30-40 min (${equipment || 'bodyweight'}), plus 10 min stretch.`,
      }
    case 'quality':
      if (phase === 'base') {
        return {
          title: 'Easy run + strides',
          notes: `${easyMilesForWeek(weekIndex, phases, mileageMultiplier)} mi easy with 4-6 short strides at the end.`,
        }
      }
      return {
        title: 'Quality: tempo/intervals',
        notes: `3-5 mi total incl. warm-up/cooldown, quality miles at stretch pace (${goal.stretch.pace}).`,
      }
    case 'long':
      return {
        title: 'Long run',
        notes: `${longRunMilesForWeek(weekIndex, phases, longestRecentRunMiles, targetLongRun)} mi, easy pace — slower than race pace on purpose.`,
      }
    case 'easy':
    default:
      return { title: 'Easy run', notes: `${easyMilesForWeek(weekIndex, phases, mileageMultiplier)} mi, conversational pace.` }
  }
}

function weekSessions(weekStart, weekIndex, phases, isLastWeek, profile, goal, targetLongRun, mileageMultiplier = 1) {
  const phase = phaseForWeek(weekIndex, phases)
  const days = profile.days || DEFAULT_PROFILE.days

  const sessions = []
  for (let offset = 0; offset < 7; offset++) {
    const kind = offsetKind(days, offset)
    // Race day replaces whichever day was chosen as the long-run day, in
    // the final week only — not hardcoded to Sunday, since the long-run day
    // is itself configurable in TrainingPlanForm.
    if (isLastWeek && kind === 'long') {
      sessions.push({
        date: addDaysISO(weekStart, offset),
        title: profile.raceName || 'Race day',
        notes: `Race day! Primary goal ${goal.primary.time} (${goal.primary.pace}), stretch ${goal.stretch.time} (${goal.stretch.pace}).`,
        phase,
      })
      continue
    }
    const { title, notes } = sessionForKind(kind, {
      weekIndex,
      phases,
      goal,
      longestRecentRunMiles: profile.longestRecentRunMiles,
      targetLongRun,
      equipment: profile.equipment,
      mileageMultiplier,
    })
    sessions.push({
      date: addDaysISO(weekStart, offset),
      title,
      notes: `[Week ${weekIndex + 1}/${phases.totalWeeks}, ${phase}] ${notes}`,
      phase,
    })
  }
  return sessions
}

// ---------------------------------------------------------------------------
// Day-of-week assignment — TrainingPlanForm.jsx lets someone pick just the
// three days that matter most (long run, quality workout, strength), and
// this fills in the remaining four as easy/rest. Mon=0 .. Sun=6.
// ---------------------------------------------------------------------------

export function buildDaysMapping(longDay, qualityDay, strengthDay) {
  const used = new Set([longDay, qualityDay, strengthDay])
  const remaining = [0, 1, 2, 3, 4, 5, 6].filter((d) => !used.has(d))
  return {
    long: [longDay],
    quality: [qualityDay],
    strength: [strengthDay],
    easy: remaining.slice(0, 2),
    rest: remaining.slice(2),
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

// Builds the full plan from a profile (see DEFAULT_PROFILE's shape).
// `profile.startISO` must be a Monday on/after today — pass
// nextMondayISO(todayISO()) from the caller (TrainingPage.jsx), since this
// module has no notion of "today" itself (keeps it a pure function, easy to
// test with fixed dates).
//
// `recentSessions` (optional, defaults to none) feeds computeTrainingAdjustment
// above — pass the last few weeks of already-logged sessions when
// regenerating an existing plan so upcoming weeks react to how training
// actually went, rather than always producing the same static ramp a fresh
// profile would. Omitting it (e.g. the very first time someone generates a
// plan, with no history yet) is identical to the old, non-dynamic behavior.
export function buildTrainingPlan(profile, recentSessions = []) {
  const { startISO } = profile
  const phases = computePhases(startISO, profile.raceDateISO)
  const goal = analyzeGoal({ ...profile, weeksAvailable: phases.totalWeeks })

  const goalStretchPaceMinPerMile = goal.stretch.minutes / profile.raceDistanceMiles
  const adjustment = computeTrainingAdjustment(recentSessions, goalStretchPaceMinPerMile)

  const adjustedGoal = adjustment.paceAdjustmentPct === 0 ? goal : (() => {
    const stretchMinutes = goal.stretch.minutes * (1 + adjustment.paceAdjustmentPct)
    return {
      ...goal,
      stretch: {
        minutes: stretchMinutes,
        time: fmtMinutesAsTime(stretchMinutes),
        pace: fmtPace(stretchMinutes, profile.raceDistanceMiles),
      },
    }
  })()

  const targetLongRun = longRunTarget(profile.raceDistanceMiles, profile.longestRecentRunMiles) * adjustment.mileageMultiplier

  const weeks = []
  for (let i = 0; i < phases.totalWeeks; i++) {
    const weekStart = toISODate(addWeeks(parseISO(startISO), i))
    weeks.push({
      weekNumber: i + 1,
      phase: phaseForWeek(i, phases),
      sessions: weekSessions(
        weekStart, i, phases, i === phases.totalWeeks - 1, profile, adjustedGoal, targetLongRun, adjustment.mileageMultiplier
      ),
    })
  }
  return { startISO, profile, phases, goal: adjustedGoal, targetLongRun, adjustment, weeks }
}

// Flattens a plan into Home Hub event-shaped objects, ready for addEvent()/
// a batch write. `owner` should be the signed-in user's uid — this is a
// personal plan, not shared with the whole family by default.
export function trainingPlanToEvents(plan, owner) {
  return plan.weeks.flatMap((w) =>
    w.sessions.map((s) => ({
      title: s.title,
      date: s.date,
      owner,
      notes: s.notes,
      trainingPlan: true,
    }))
  )
}
