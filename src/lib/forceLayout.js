// A small force-directed layout (no library): nodes push each other
// apart, connections pull like springs, and a soft pull to the middle
// keeps the web together. `step` runs one tick; call it until `alpha`
// (how much energy is left) has died down.

const REPEL = 7000
const SPRING = 0.06
const GRAVITY = 0.012
const DAMPING = 0.55

// Starting positions: around a circle, grouped by type, so each run of
// the same web settles the same way.
export function seedPositions(nodes, previous = new Map()) {
  const positions = new Map()
  const fresh = nodes.filter((n) => !previous.has(n.key))
  const radius = 40 + Math.sqrt(nodes.length) * 28
  fresh
    .slice()
    .sort((a, b) => a.type.localeCompare(b.type) || a.key.localeCompare(b.key))
    .forEach((n, i) => {
      const angle = (i / Math.max(1, fresh.length)) * Math.PI * 2
      positions.set(n.key, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: 0, vy: 0, fixed: false })
    })
  for (const n of nodes) if (previous.has(n.key)) positions.set(n.key, previous.get(n.key))
  return positions
}

export function step(nodes, edges, positions, alpha) {
  const list = nodes.map((n) => positions.get(n.key))
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]
      let dx = a.x - b.x
      let dy = a.y - b.y
      let d2 = dx * dx + dy * dy
      if (d2 < 0.01) {
        dx = (i - j) * 0.1 || 0.1
        dy = 0.1
        d2 = dx * dx + dy * dy
      }
      const d = Math.sqrt(d2)
      const f = (REPEL * alpha) / Math.max(d2, 64)
      const fx = (dx / d) * f
      const fy = (dy / d) * f
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }
  }
  for (const e of edges) {
    const a = positions.get(e.a)
    const b = positions.get(e.b)
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    // Stronger ties sit a little closer.
    const rest = Math.max(80, 150 - e.weight * 12)
    const f = (d - rest) * SPRING * alpha * Math.min(2, 1 + e.weight * 0.2)
    a.vx += (dx / d) * f
    a.vy += (dy / d) * f
    b.vx -= (dx / d) * f
    b.vy -= (dy / d) * f
  }
  for (const p of list) {
    p.vx -= p.x * GRAVITY * alpha
    p.vy -= p.y * GRAVITY * alpha
    if (p.fixed) {
      p.vx = 0
      p.vy = 0
      continue
    }
    p.vx *= DAMPING
    p.vy *= DAMPING
    p.x += p.vx
    p.y += p.vy
  }
}

export function bounds(nodes, positions) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    const p = positions.get(n.key)
    if (!p) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return minX === Infinity ? { minX: -100, minY: -100, maxX: 100, maxY: 100 } : { minX, minY, maxX, maxY }
}
