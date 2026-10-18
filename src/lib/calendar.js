// The campaign's in-world calendar: a day count ("Day 47") that moves on
// as the party rests and travels, and deadlines on quests and party goals
// stored as the day they're due.

export const FIRST_DAY = 1

// The patch that moves the calendar on by `days` (or back, to fix a
// mistake), logging why: [{ from, to, note, at }], newest last, capped.
export function advanceDays(calendar, days, note = '', now = new Date()) {
  const from = calendar?.day ?? FIRST_DAY
  const to = Math.max(FIRST_DAY, from + Math.trunc(days))
  if (to === from) return null
  const log = Array.isArray(calendar?.log) ? calendar.log : []
  return { day: to, log: [...log, { from, to, note: note.trim(), at: now.toISOString() }].slice(-100) }
}

// "Due in 4 days" from today → the day it's due.
export const dueDayFromNow = (today, inDays) => (inDays === '' || inDays === null || inDays === undefined ? null : today + Math.max(0, Math.trunc(Number(inDays))))

// A stored due day → the form's "due in N days" ('' for none).
export function dueInFromDay(dueDay, today) {
  const left = daysLeft(dueDay, today)
  return left === null ? '' : String(Math.max(0, left))
}

// What to save from the form: the original due day if the field wasn't
// touched (so an overdue deadline isn't quietly moved to today), else
// the day `dueIn` days from today.
export function dueDayFromForm(dueIn, initialDueIn, originalDueDay, today) {
  if (originalDueDay != null && dueIn === initialDueIn) return originalDueDay
  return dueDayFromNow(today, dueIn)
}

// Days left until a deadline (negative once it's passed), or null.
export const daysLeft = (dueDay, today) => (dueDay === null || dueDay === undefined ? null : dueDay - today)

// What a deadline badge says, and how worried to look.
export function deadline(dueDay, today) {
  const left = daysLeft(dueDay, today)
  if (left === null) return null
  if (left < 0) return { text: `Overdue by ${-left} day${left === -1 ? '' : 's'}`, tone: 'overdue', left }
  if (left === 0) return { text: 'Due today', tone: 'due', left }
  if (left === 1) return { text: 'Due tomorrow', tone: 'soon', left }
  return { text: `${left} days left`, tone: left <= 3 ? 'soon' : 'ok', left }
}

// "+3 days" / "−1 day" for a calendar log entry.
export function stepLabel(entry) {
  const d = entry.to - entry.from
  return `${d > 0 ? '+' : '−'}${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`
}
