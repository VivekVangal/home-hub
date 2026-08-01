import { describe, test, expect } from 'vitest'
import { calendarSyncWindow, mapGoogleEventToFields, mapGoogleTaskToFields, planUpserts } from './google.js'

describe('calendarSyncWindow', () => {
  test('spans 7 days back and 90 days ahead of the given time', () => {
    const now = new Date('2026-08-01T12:00:00.000Z').getTime()
    const { timeMin, timeMax } = calendarSyncWindow(now)
    expect(timeMin).toBe('2026-07-25T12:00:00.000Z')
    expect(timeMax).toBe('2026-10-30T12:00:00.000Z')
  })
})

describe('mapGoogleEventToFields', () => {
  test('maps an all-day event', () => {
    const fields = mapGoogleEventToFields({
      id: 'evt1', summary: 'Dentist', status: 'confirmed',
      start: { date: '2026-08-05' }, end: { date: '2026-08-06' },
    })
    expect(fields).toEqual({
      googleEventId: 'evt1', googleImported: true, title: 'Dentist',
      date: '2026-08-05', startTime: '', endTime: '', notes: '',
    })
  })

  test('maps a timed event, extracting HH:MM', () => {
    const fields = mapGoogleEventToFields({
      id: 'evt2', summary: 'Standup', description: 'Daily sync', status: 'confirmed',
      start: { dateTime: '2026-08-05T09:30:00-04:00' },
      end: { dateTime: '2026-08-05T09:45:00-04:00' },
    })
    expect(fields).toMatchObject({ date: '2026-08-05', startTime: '09:30', endTime: '09:45', notes: 'Daily sync' })
  })

  test('returns null for a cancelled event', () => {
    expect(mapGoogleEventToFields({ id: 'evt3', status: 'cancelled', start: { date: '2026-08-05' } })).toBeNull()
  })

  test('returns null when there is no start date at all', () => {
    expect(mapGoogleEventToFields({ id: 'evt4', status: 'confirmed', start: {} })).toBeNull()
  })

  test('falls back to a placeholder title when summary is missing', () => {
    const fields = mapGoogleEventToFields({ id: 'evt5', status: 'confirmed', start: { date: '2026-08-05' } })
    expect(fields.title).toBe('(untitled)')
  })
})

describe('mapGoogleTaskToFields', () => {
  test('maps a task with a due date', () => {
    const fields = mapGoogleTaskToFields({
      id: 'task1', title: 'Buy milk', notes: 'whole, not skim', due: '2026-08-05T00:00:00.000Z', status: 'needsAction',
    })
    expect(fields).toEqual({
      googleTaskId: 'task1', googleImported: true, type: 'todo',
      title: 'Buy milk', dueDate: '2026-08-05', notes: 'whole, not skim', done: false,
    })
  })

  test('maps a completed task with no due date', () => {
    const fields = mapGoogleTaskToFields({ id: 'task2', title: 'Renew library card', status: 'completed' })
    expect(fields).toMatchObject({ dueDate: '', done: true })
  })
})

describe('planUpserts', () => {
  const mapFn = (raw) => (raw.skip ? null : { googleEventId: raw.id, title: raw.title })

  test('creates new items that have no matching existing doc', () => {
    const { toCreate, toUpdate } = planUpserts([], [{ id: 'g1', title: 'New event' }], { idField: 'googleEventId', mapFn })
    expect(toCreate).toEqual([{ googleEventId: 'g1', title: 'New event' }])
    expect(toUpdate).toEqual([])
  })

  test('updates the matching existing doc instead of creating a duplicate', () => {
    const existing = [{ id: 'home-hub-id-1', googleEventId: 'g1', title: 'Old title' }]
    const { toCreate, toUpdate } = planUpserts(existing, [{ id: 'g1', title: 'Updated title' }], { idField: 'googleEventId', mapFn })
    expect(toCreate).toEqual([])
    expect(toUpdate).toEqual([{ id: 'home-hub-id-1', fields: { googleEventId: 'g1', title: 'Updated title' } }])
  })

  test('skips items the mapper returns null for', () => {
    const { toCreate, toUpdate } = planUpserts([], [{ id: 'g1', skip: true }], { idField: 'googleEventId', mapFn })
    expect(toCreate).toEqual([])
    expect(toUpdate).toEqual([])
  })
})
