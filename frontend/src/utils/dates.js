import { startOfWeek, addDays, format, parseISO, isBefore, startOfDay } from 'date-fns'

export const toISODate = (date) => format(date, 'yyyy-MM-dd')

export const todayISO = () => toISODate(new Date())

// Monday-start week, matches typical US household planning (groceries on Sunday/Monday).
export const getWeekStart = (date = new Date()) =>
  toISODate(startOfWeek(date, { weekStartsOn: 1 }))

export const getWeekDays = (weekStartISO) => {
  const start = parseISO(weekStartISO)
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(start, i)))
}

export const formatDisplayDate = (isoDate) => format(parseISO(isoDate), 'EEE, MMM d')

export const formatShortDate = (isoDate) => format(parseISO(isoDate), 'MMM d')

export const formatDayLabel = (isoDate) => format(parseISO(isoDate), 'EEEE')

export const isPastDue = (isoDate) => isBefore(parseISO(isoDate), startOfDay(new Date()))

export const addDaysISO = (isoDate, days) => toISODate(addDays(parseISO(isoDate), days))
