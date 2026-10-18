// Party goals: what the party as a whole is working towards, broken into
// steps that fill a progress ring.

export const goalFromRow = (r) => ({
  id: r.id,
  title: r.title,
  status: r.status,
  notes: r.notes || '',
  steps: Array.isArray(r.steps) ? r.steps : [],
  completedAt: r.completed_at || null,
  dueDay: r.due_day ?? null,
  createdAt: r.created_at,
})

// 0–1. A goal with no steps counts as done only once it's achieved.
export function goalProgress(goal) {
  if (goal.status === 'Completed') return 1
  if (!goal.steps.length) return 0
  return goal.steps.filter((s) => s.done).length / goal.steps.length
}

// The first step not yet done ("Next: find a shipwright").
export const nextStep = (goal) => goal.steps.find((s) => !s.done) || null

export const readyToComplete = (goal) =>
  goal.status !== 'Completed' && goal.steps.length > 0 && goal.steps.every((s) => s.done)

export function newStep(text) {
  return { id: crypto.randomUUID(), text: text.trim(), done: false }
}

export const toggleStep = (steps, id) => steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
export const removeStep = (steps, id) => steps.filter((s) => s.id !== id)
export const renameStep = (steps, id, text) => steps.map((s) => (s.id === id ? { ...s, text } : s))

// Active goals in the order they were set (so a card doesn't jump while
// its steps are ticked), then achieved ones, newest first.
export function sortGoals(goals) {
  const active = goals
    .filter((g) => g.status !== 'Completed')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const achieved = goals
    .filter((g) => g.status === 'Completed')
    .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
  return { active, achieved }
}
