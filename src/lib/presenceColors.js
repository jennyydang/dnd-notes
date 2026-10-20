// A colour for each person in the campaign right now, so faces, names and
// "also here" dots can be told apart. Bright enough on the dark panels;
// gold is left out because the app's own UI uses it.
// In handing-out order: each next colour contrasts with the ones before.
export const PRESENCE_COLORS = [
  '#e07a5f', // coral
  '#5fa8e0', // sky
  '#cfd66a', // lime
  '#c792ea', // violet
  '#4fc9bd', // teal
  '#f2a65a', // orange
  '#9aa7ff', // periwinkle
  '#7fc47a', // leaf
  '#f28fad', // rose
  '#d9a066', // copper
]

// playerId → colour for everyone present, given as { playerId, onlineAt }.
// Colours go out in the order people arrived (ties by id), so the first
// few are always far apart, nobody's colour changes while they stay, and
// every device works out the same answer. Past ten people they repeat.
export function assignColors(people) {
  const order = [...people].sort(
    (a, b) => (a.onlineAt || '').localeCompare(b.onlineAt || '') || a.playerId.localeCompare(b.playerId),
  )
  const colors = new Map()
  for (const { playerId } of order) {
    if (!colors.has(playerId)) colors.set(playerId, PRESENCE_COLORS[colors.size % PRESENCE_COLORS.length])
  }
  return colors
}
