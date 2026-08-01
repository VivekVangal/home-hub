import { describe, test, expect } from 'vitest'
import { STRENGTH_EXERCISES, STRETCH_EXERCISES, pickWeeklyExercises, exerciseById } from '../../lib/exercises.js'

describe('exercise data', () => {
  test('every strength/stretch exercise has a unique id, a name, and a real-looking reference URL', () => {
    const all = [...STRENGTH_EXERCISES, ...STRETCH_EXERCISES]
    const ids = all.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length) // no duplicate ids across either list
    all.forEach((e) => {
      expect(e.name).toBeTruthy()
      expect(e.instructions).toBeTruthy()
      expect(e.reps).toBeTruthy()
      expect(e.referenceUrl).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/)
    })
  })
})

describe('illustrations', () => {
  const all = [...STRENGTH_EXERCISES, ...STRETCH_EXERCISES]
  const illustrated = all.filter((e) => e.illustration)

  test('at least one exercise has a real illustration', () => {
    expect(illustrated.length).toBeGreaterThan(0)
  })

  test('every illustration is hotlinked directly from Wikimedia (not a third-party mirror), and carries attribution', () => {
    illustrated.forEach((e) => {
      expect(e.illustration.url).toMatch(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//)
      expect(e.illustration.credit).toBeTruthy()
      expect(e.illustration.license).toBeTruthy()
      expect(e.illustration.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
    })
  })

  test('exercises without a verified illustration have illustration: null, not left undefined', () => {
    all.filter((e) => !e.illustration).forEach((e) => {
      expect(e.illustration).toBeNull()
    })
  })
})

describe('pickWeeklyExercises', () => {
  test('returns the requested count of strength and stretch exercises', () => {
    const { strength, stretch } = pickWeeklyExercises(0)
    expect(strength).toHaveLength(4)
    expect(stretch).toHaveLength(2)
  })

  test('is deterministic — the same weekIndex always picks the same exercises', () => {
    const a = pickWeeklyExercises(3)
    const b = pickWeeklyExercises(3)
    expect(a.strength.map((e) => e.id)).toEqual(b.strength.map((e) => e.id))
    expect(a.stretch.map((e) => e.id)).toEqual(b.stretch.map((e) => e.id))
  })

  test('different weeks tend to pick different exercises (variety, not the same set every week)', () => {
    const week0 = pickWeeklyExercises(0).strength.map((e) => e.id)
    const week1 = pickWeeklyExercises(1).strength.map((e) => e.id)
    expect(week0).not.toEqual(week1)
  })

  test('never returns more exercises than actually exist in a list', () => {
    const { strength } = pickWeeklyExercises(0, { strengthCount: 999 })
    expect(strength).toHaveLength(STRENGTH_EXERCISES.length)
  })

  test('picks within each list without ever returning duplicates in the same week', () => {
    for (let week = 0; week < 10; week++) {
      const { strength, stretch } = pickWeeklyExercises(week)
      expect(new Set(strength.map((e) => e.id)).size).toBe(strength.length)
      expect(new Set(stretch.map((e) => e.id)).size).toBe(stretch.length)
    }
  })
})

describe('exerciseById', () => {
  test('finds a strength exercise by id', () => {
    expect(exerciseById('squat')?.name).toBe('Bodyweight squat')
  })

  test('finds a stretch exercise by id', () => {
    expect(exerciseById('calf-stretch')?.name).toBe('Wall calf stretch')
  })

  test('returns null for an unknown id', () => {
    expect(exerciseById('not-a-real-exercise')).toBeNull()
  })
})
