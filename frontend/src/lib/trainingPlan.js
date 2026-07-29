// ---------------------------------------------------------------------------
// Half-marathon training plan generator — turns HALF_MARATHON_PLAN.md's
// methodology into concrete, dated sessions. Pure functions only (no
// Firestore/db.js calls here) so this is easy to unit test; TrainingPage.jsx
// is what actually persists the output via db.js.
// ---------------------------------------------------------------------------

import { addDaysISO, toISODate } from '../utils/dates.js'
import { parseISO, startOfWeek, addWeeks, differenceInCalendarWeeks } from 'date-fns'

export const RACE_DATE_ISO = '2026-10-18' // Baystate Half Marathon (Sunday)
export const RACE_NAME = 'Baystate Half Marathon'

// Two-tier goal, per HALF_MARATHON_PLAN.md: a realistic primary target and
// the sub-2:15 stretch kept alive in the quality-workout paces.
export const PACE = {
  easy: '11:30-12:30/mi',
  primaryLongRun: '11:00-11:50/mi',
  stretchQuality: '10:00-10:18/mi',
}

const PHASE_SHARE = { base: 4 / 12, build: 5 / 12, taper: 3 / 12 }

// Monday-start week containing (or equal to) the given ISO date.
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
    // Borrow back from build first, then base, keeping every phase >= 1 week.
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

// Linear interpolation helper, clamped to [a, b] as t goes 0 -> 1.
function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

// Long-run distance (miles) for a given week index, following the plan's
// 3 -> 6 (base) -> 10-11 (build peak, week before taper) -> 8 -> shorter
// (taper) progression, scaled to however many weeks are actually available.
function longRunMiles(weekIndex, phases) {
  const { base, build, taper } = phases
  const phase = phaseForWeek(weekIndex, phases)
  if (phase === 'base') {
    return Math.round(lerp(3, 6, base <= 1 ? 1 : weekIndex / (base - 1)))
  }
  if (phase === 'build') {
    const i = weekIndex - base
    return Math.round(lerp(6, 11, build <= 1 ? 1 : i / (build - 1)))
  }
  const i = weekIndex - base - build
  return Math.round(lerp(8, 2, taper <= 1 ? 1 : i / (taper - 1))) // race-week Sunday is the race itself, handled separately
}

// One week's session list, Monday -> Sunday, per the template in
// HALF_MARATHON_PLAN.md. `isLastWeek` swaps Sunday for race day itself.
function weekSessions(weekStart, weekIndex, phases, isLastWeek) {
  const phase = phaseForWeek(weekIndex, phases)
  const inBuildOrLater = phase !== 'base'
  const miles = longRunMiles(weekIndex, phases)

  const days = [
    { offset: 0, title: 'Rest / mobility', notes: '20 min easy walk or mobility work. Full rest is fine too.' },
    { offset: 1, title: 'Easy run', notes: `3-4 mi, conversational pace (${PACE.easy}).` },
    { offset: 2, title: 'Strength + stretch', notes: 'Lower body + core, 30-40 min, plus 10 min stretch.' },
    inBuildOrLater
      ? { offset: 3, title: 'Quality: tempo/intervals', notes: `3-5 mi total incl. warm-up/cooldown, quality miles at stretch pace (${PACE.stretchQuality}).` }
      : { offset: 3, title: 'Easy run + strides', notes: `3-4 mi easy (${PACE.easy}) with 4-6 short strides at the end.` },
    { offset: 4, title: 'Rest or cross-train', notes: 'Rest, or 30 min easy bike/swim.' },
    { offset: 5, title: 'Easy run', notes: `3-4 mi, conversational pace (${PACE.easy}).` },
  ]

  if (isLastWeek) {
    days.push({ offset: 6, title: RACE_NAME, notes: `Race day! Goal: primary 2:25-2:35 (${PACE.primaryLongRun}), stretch sub-2:15 (${PACE.stretchQuality}).` })
  } else {
    days.push({ offset: 6, title: 'Long run', notes: `${miles} mi, easy pace (${PACE.easy}) — slower than race pace on purpose.` })
  }

  return days.map((d) => ({
    date: addDaysISO(weekStart, d.offset),
    title: d.title,
    notes: `[Week ${weekIndex + 1}/${phases.totalWeeks}, ${phase}] ${d.notes}`,
    phase,
  }))
}

// Builds the full plan: an array of { weekNumber, phase, sessions: [...] }.
// `startISO` should be a Monday (use nextMondayISO(todayISO()) if unsure).
export function buildTrainingPlan(startISO, raceISO = RACE_DATE_ISO) {
  const phases = computePhases(startISO, raceISO)
  const weeks = []
  for (let i = 0; i < phases.totalWeeks; i++) {
    const weekStart = toISODate(addWeeks(parseISO(startISO), i))
    weeks.push({
      weekNumber: i + 1,
      phase: phaseForWeek(i, phases),
      sessions: weekSessions(weekStart, i, phases, i === phases.totalWeeks - 1),
    })
  }
  return { startISO, raceISO, phases, weeks }
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
