import { describe, test, expect, beforeEach } from 'vitest'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import {
  setFamilyId,
  getPeople, updatePerson, deletePerson,
  getEvents, addEvent, updateEvent, deleteEvent,
  getGroceryItems, addGroceryItem, updateGroceryItem, deleteGroceryItem, clearCheckedGroceryItems,
  getTasks, addTask, updateTask, deleteTask, completeTask,
} from '../db.js'

// db.js is Firestore-backed and scoped to whatever family id is currently
// set via setFamilyId(). Tests run against the in-memory fake Firestore in
// src/test/mocks/firestoreMock.js (registered globally in test/setup.js),
// which is reset before every test, so each test here starts empty.

const FAMILY_ID = 'test-family'

// Members now come from real accounts joining a family (FamilyContext,
// tested separately) rather than an "addPerson" function in db.js, so tests
// that need an existing member seed one directly the same way
// FamilyContext.createFamily/joinFamily would.
async function seedMember(id, data) {
  await setDoc(doc(db, 'families', FAMILY_ID, 'members', id), {
    uid: id, name: data.name, color: data.color, role: data.role || 'member', joinedAt: null,
  })
}

beforeEach(() => {
  setFamilyId(FAMILY_ID)
})

describe('people', () => {
  test('getPeople returns an empty list for a family with no members yet', async () => {
    expect(await getPeople()).toEqual([])
  })

  test('getPeople returns members that have joined', async () => {
    await seedMember('u1', { name: 'Vivek', color: '#3b82f6' })
    await seedMember('u2', { name: 'Partner', color: '#ec4899' })
    const people = await getPeople()
    expect(people.map((p) => p.name).sort()).toEqual(['Partner', 'Vivek'])
  })

  test('updatePerson renames and recolors an existing member', async () => {
    await seedMember('u1', { name: 'Vivek', color: '#3b82f6' })
    const updated = await updatePerson('u1', { name: 'Renamed', color: '#000000' })
    expect(updated.name).toBe('Renamed')
    expect(updated.color).toBe('#000000')
    const people = await getPeople()
    expect(people.find((p) => p.id === 'u1').name).toBe('Renamed')
  })

  test('updatePerson on an unknown id returns null and changes nothing', async () => {
    await seedMember('u1', { name: 'Vivek', color: '#3b82f6' })
    const result = await updatePerson('nonexistent-id', { name: 'Ghost' })
    expect(result).toBeNull()
    const people = await getPeople()
    expect(people).toHaveLength(1)
  })

  test('deletePerson removes them and reassigns their events/tasks/groceries to "all"', async () => {
    await seedMember('u1', { name: 'Vivek', color: '#3b82f6' })
    const event = await addEvent({ title: 'Dentist', date: '2026-02-01', owner: 'u1' })
    const task = await addTask({ title: 'Fix fence', owner: 'u1' })
    const item = await addGroceryItem({ name: 'Milk', weekStart: '2026-02-02', addedBy: 'u1' })

    await deletePerson('u1')

    const people = await getPeople()
    expect(people.find((p) => p.id === 'u1')).toBeUndefined()

    const events = await getEvents()
    expect(events.find((e) => e.id === event.id).owner).toBe('all')

    const tasks = await getTasks()
    expect(tasks.find((t) => t.id === task.id).owner).toBe('all')

    const groceries = await getGroceryItems('2026-02-02')
    expect(groceries.find((g) => g.id === item.id).addedBy).toBe('all')
  })
})

describe('events', () => {
  test('addEvent applies defaults and getEvents returns it', async () => {
    const event = await addEvent({ title: 'Soccer practice', date: '2026-03-01' })
    expect(event.id).toBeTruthy()
    expect(event.notes).toBe('')
    expect(event.startTime).toBe('')

    const events = await getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Soccer practice')
  })

  test('getEvents sorts by date then start time', async () => {
    await addEvent({ title: 'Later same day', date: '2026-03-01', startTime: '15:00' })
    await addEvent({ title: 'Earlier day', date: '2026-02-28', startTime: '09:00' })
    await addEvent({ title: 'Earlier same day', date: '2026-03-01', startTime: '08:00' })

    const events = await getEvents()
    expect(events.map((e) => e.title)).toEqual([
      'Earlier day', 'Earlier same day', 'Later same day',
    ])
  })

  test('updateEvent merges changes and preserves other fields', async () => {
    const event = await addEvent({ title: 'Original', date: '2026-03-01', notes: 'keep me' })
    const updated = await updateEvent(event.id, { title: 'Renamed' })
    expect(updated.title).toBe('Renamed')
    expect(updated.notes).toBe('keep me')
  })

  test('updateEvent on unknown id returns null', async () => {
    expect(await updateEvent('missing', { title: 'x' })).toBeNull()
  })

  test('deleteEvent removes only the targeted event', async () => {
    const a = await addEvent({ title: 'Keep', date: '2026-03-01' })
    const b = await addEvent({ title: 'Remove', date: '2026-03-02' })
    await deleteEvent(b.id)
    const events = await getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe(a.id)
  })

  test('events from a different family are not visible', async () => {
    await addEvent({ title: 'Family A event', date: '2026-03-01' })
    setFamilyId('other-family')
    expect(await getEvents()).toEqual([])
    setFamilyId(FAMILY_ID)
    expect(await getEvents()).toHaveLength(1)
  })
})

describe('groceries', () => {
  test('addGroceryItem applies defaults', async () => {
    const item = await addGroceryItem({ name: 'Eggs', weekStart: '2026-03-02' })
    expect(item.checked).toBe(false)
    expect(item.category).toBe('Other')
    expect(item.addedBy).toBe('all')
  })

  test('getGroceryItems only returns items for the requested week', async () => {
    await addGroceryItem({ name: 'This week', weekStart: '2026-03-02' })
    await addGroceryItem({ name: 'Other week', weekStart: '2026-03-09' })
    const items = await getGroceryItems('2026-03-02')
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('This week')
  })

  test('updateGroceryItem toggles checked state', async () => {
    const item = await addGroceryItem({ name: 'Bread', weekStart: '2026-03-02' })
    const updated = await updateGroceryItem(item.id, { checked: true })
    expect(updated.checked).toBe(true)
  })

  test('deleteGroceryItem removes only the targeted item', async () => {
    const a = await addGroceryItem({ name: 'Keep', weekStart: '2026-03-02' })
    const b = await addGroceryItem({ name: 'Remove', weekStart: '2026-03-02' })
    await deleteGroceryItem(b.id)
    const items = await getGroceryItems('2026-03-02')
    expect(items.map((i) => i.id)).toEqual([a.id])
  })

  test('clearCheckedGroceryItems only clears checked items in the given week', async () => {
    const checkedThisWeek = await addGroceryItem({ name: 'Done', weekStart: '2026-03-02', checked: true })
    const uncheckedThisWeek = await addGroceryItem({ name: 'Not done', weekStart: '2026-03-02', checked: false })
    const checkedOtherWeek = await addGroceryItem({ name: 'Done elsewhere', weekStart: '2026-03-09', checked: true })

    await clearCheckedGroceryItems('2026-03-02')

    const thisWeek = await getGroceryItems('2026-03-02')
    expect(thisWeek.map((i) => i.id)).toEqual([uncheckedThisWeek.id])

    const otherWeek = await getGroceryItems('2026-03-09')
    expect(otherWeek.map((i) => i.id)).toEqual([checkedOtherWeek.id])
  })
})

describe('tasks', () => {
  test('addTask applies defaults', async () => {
    const task = await addTask({ title: 'Call plumber' })
    expect(task.type).toBe('todo')
    expect(task.owner).toBe('all')
    expect(task.recurrence).toBe('none')
    expect(task.done).toBe(false)
  })

  test('getTasks sorts by due date, undated tasks last', async () => {
    await addTask({ title: 'No date' })
    await addTask({ title: 'Later', dueDate: '2026-05-01' })
    await addTask({ title: 'Sooner', dueDate: '2026-04-01' })

    const tasks = await getTasks()
    expect(tasks.map((t) => t.title)).toEqual(['Sooner', 'Later', 'No date'])
  })

  test('completeTask marks a one-time task done without spawning a new one', async () => {
    const task = await addTask({ title: 'One-time', dueDate: '2026-04-01', recurrence: 'none' })
    await completeTask(task.id)
    const tasks = await getTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].done).toBe(true)
  })

  test('completeTask on a recurring task marks it done and spawns the next occurrence', async () => {
    const task = await addTask({
      title: 'Change HVAC filter', dueDate: '2026-01-01', recurrence: 'monthly', type: 'maintenance',
    })
    await completeTask(task.id)
    const tasks = await getTasks()
    expect(tasks).toHaveLength(2)

    const original = tasks.find((t) => t.id === task.id)
    expect(original.done).toBe(true)

    const next = tasks.find((t) => t.id !== task.id)
    expect(next.done).toBe(false)
    expect(next.title).toBe('Change HVAC filter')
    expect(next.dueDate).toBe('2026-01-31') // +30 days for 'monthly'
  })

  test('completeTask is a no-op for an unknown id', async () => {
    const result = await completeTask('missing')
    expect(result).toBeNull()
  })

  test('deleteTask removes only the targeted task', async () => {
    const a = await addTask({ title: 'Keep' })
    const b = await addTask({ title: 'Remove' })
    await deleteTask(b.id)
    const tasks = await getTasks()
    expect(tasks.map((t) => t.id)).toEqual([a.id])
  })
})
