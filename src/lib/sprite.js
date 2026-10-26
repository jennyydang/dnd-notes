// Chibi pixel-art character sprites, drawn from a few choices (skin,
// hair, outfit, headwear, gear, race traits). Each part is painted as
// flat "materials" on a small grid; shading and the dark outline are
// worked out afterwards, so any combination looks hand-drawn.
//
// Views: front, back, left, right. Frames: 0 standing, 1 and 2 mid-step.

export const W = 24
export const H = 36
const Y = 4 // room above the head for hats and horns

// ── Palettes ─────────────────────────────────────────────────────────────
// Each colour: [base, shade, highlight].
export const SKIN = {
  fair: ['#f6d3b3', '#dba37f', '#fde6d2'],
  tan: ['#e0a878', '#b97b52', '#f0c49b'],
  brown: ['#a86b45', '#7f4a2c', '#c4875c'],
  deep: ['#6b412a', '#4a2a19', '#86563a'],
  infernal: ['#c4504a', '#933530', '#de7a6f'],
  green: ['#86a85e', '#5b7a3c', '#a7c77d'],
  ash: ['#8c7fae', '#675a88', '#ab9fc9'],
  stone: ['#9aa3a8', '#717a80', '#b9c1c5'],
}
export const HAIR = {
  ember: ['#d8541f', '#a3370f', '#f08a3c'],
  black: ['#2b2530', '#17121b', '#4a4252'],
  brown: ['#6b4224', '#4a2b14', '#8c5b35'],
  blonde: ['#e6c25a', '#b8912f', '#f6dd8c'],
  white: ['#e8e4dc', '#b9b3a8', '#ffffff'],
  silver: ['#a9b4bf', '#7c8792', '#d0d8df'],
  blue: ['#3f6fd1', '#2a4c97', '#6f97ea'],
  violet: ['#8a4fc4', '#62348f', '#b07ddf'],
  green: ['#4f9a4a', '#346d31', '#78bf6f'],
  pink: ['#e57aa8', '#b8507c', '#f6a7c8'],
}
export const CLOTH = {
  teal: ['#2a8f8a', '#1b6360', '#45b3ad'],
  umber: ['#8a5a32', '#5f3b1d', '#ab7a4d'],
  moss: ['#7a7436', '#555021', '#9c9650'],
  crimson: ['#a8323a', '#771f26', '#cc545b'],
  navy: ['#2d4a8a', '#1d3160', '#4a6ab0'],
  plum: ['#6f3f8f', '#4d2964', '#9160b2'],
  forest: ['#2f6b3a', '#1f4a27', '#4b8d57'],
  slate: ['#5a6370', '#3d444d', '#7b8592'],
  bone: ['#d9cfb8', '#ab9f85', '#f1e9d6'],
  gold: ['#c9a227', '#8a6f22', '#e8c766'],
}
const EYE_COLORS = { brown: '#5a3216', blue: '#2f6fd8', green: '#2f8f3f', amber: '#d89a1f', red: '#c22a2a', violet: '#7d3fc4' }
export const EYE = EYE_COLORS
const FIXED = {
  metal: ['#b9c2c9', '#7d8790', '#e6ecf0'],
  wood: ['#8a5a32', '#5f3b1d', '#ab7a4d'],
  horn: ['#ded3bd', '#a99d86', '#f5eee0'],
  tusk: ['#f2ecdc', '#cfc6b0', '#ffffff'],
  gem: ['#45c4e8', '#2286a8', '#a4ecff'],
  white: ['#ffffff', '#ffffff', '#ffffff'],
  mouth: ['#8a3a2a', '#8a3a2a', '#8a3a2a'],
}
const OUTLINE = '#1a1210'
const SHADOW = 'rgba(0,0,0,0.28)'

// ── Options ──────────────────────────────────────────────────────────────
export const OPTIONS = {
  hairStyle: [
    ['short', 'Short'],
    ['spiky', 'Spiky'],
    ['long', 'Long'],
    ['bob', 'Bob'],
    ['ponytail', 'Ponytail'],
    ['bun', 'Bun'],
    ['mohawk', 'Mohawk'],
    ['bald', 'Bald'],
  ],
  eyes: [
    ['round', 'Round'],
    ['dot', 'Dot'],
    ['narrow', 'Narrow'],
  ],
  outfit: [
    ['tunic', 'Tunic'],
    ['robe', 'Robe'],
    ['cloak', 'Cloak'],
    ['armor', 'Armour'],
    ['dress', 'Dress'],
  ],
  hat: [
    ['none', 'None'],
    ['hood', 'Hood'],
    ['wizard', 'Wizard hat'],
    ['helmet', 'Helmet'],
    ['headband', 'Headband'],
    ['crown', 'Circlet'],
  ],
  weapon: [
    ['none', 'None'],
    ['sword', 'Sword'],
    ['staff', 'Staff'],
    ['axe', 'Axe'],
    ['dagger', 'Dagger'],
    ['bow', 'Bow'],
  ],
  offhand: [
    ['none', 'None'],
    ['shield', 'Shield'],
    ['book', 'Spellbook'],
    ['lantern', 'Lantern'],
  ],
}

// Races set skin and traits; everything stays editable after.
export const RACES = {
  human: { label: 'Human', skin: 'fair', ears: false, horns: false, beard: false, tusks: false },
  elf: { label: 'Elf', skin: 'fair', ears: true, horns: false, beard: false, tusks: false },
  drow: { label: 'Drow', skin: 'ash', ears: true, horns: false, beard: false, tusks: false, hairColor: 'white' },
  dwarf: { label: 'Dwarf', skin: 'tan', ears: false, horns: false, beard: true, tusks: false },
  halfling: { label: 'Halfling', skin: 'tan', ears: false, horns: false, beard: false, tusks: false },
  tiefling: { label: 'Tiefling', skin: 'infernal', ears: false, horns: true, beard: false, tusks: false, eyeColor: 'amber' },
  orc: { label: 'Half-orc', skin: 'green', ears: true, horns: false, beard: false, tusks: true },
  goliath: { label: 'Goliath', skin: 'stone', ears: false, horns: false, beard: false, tusks: false, hairStyle: 'bald' },
}

export const DEFAULT_SPRITE = {
  race: 'human',
  skin: 'fair',
  hairStyle: 'spiky',
  hairColor: 'ember',
  eyes: 'round',
  eyeColor: 'brown',
  outfit: 'tunic',
  outfitColor: 'teal',
  accentColor: 'umber',
  bootsColor: 'umber',
  hat: 'none',
  weapon: 'none',
  offhand: 'none',
  ears: false,
  horns: false,
  beard: false,
  tusks: false,
}

export function applyRace(config, race) {
  const r = RACES[race]
  if (!r) return config
  const next = { ...config, race, skin: r.skin, ears: r.ears, horns: r.horns, beard: r.beard, tusks: r.tusks }
  if (r.hairColor) next.hairColor = r.hairColor
  if (r.eyeColor) next.eyeColor = r.eyeColor
  if (r.hairStyle) next.hairStyle = r.hairStyle
  return next
}

const pickFrom = (list, rand) => list[Math.floor(rand() * list.length)]
export function randomSprite(rand = Math.random) {
  const race = pickFrom(Object.keys(RACES), rand)
  const base = applyRace(DEFAULT_SPRITE, race)
  const keys = (o) => Object.keys(o)
  const opt = (k) => pickFrom(OPTIONS[k], rand)[0]
  return {
    ...base,
    hairStyle: RACES[race].hairStyle || opt('hairStyle'),
    hairColor: RACES[race].hairColor || pickFrom(keys(HAIR), rand),
    eyes: opt('eyes'),
    eyeColor: RACES[race].eyeColor || pickFrom(keys(EYE_COLORS), rand),
    outfit: opt('outfit'),
    outfitColor: pickFrom(keys(CLOTH), rand),
    accentColor: pickFrom(keys(CLOTH), rand),
    bootsColor: pickFrom(['umber', 'slate', 'moss', 'teal'], rand),
    hat: rand() < 0.5 ? 'none' : opt('hat'),
    weapon: opt('weapon'),
    offhand: rand() < 0.5 ? 'none' : opt('offhand'),
  }
}

// ── Painting ─────────────────────────────────────────────────────────────
function canvasGrid() {
  return Array.from({ length: H }, () => Array(W).fill(null))
}

function painter(grid) {
  const put = (x, y, m) => {
    x = Math.round(x)
    y = Math.round(y) + Y
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = m
  }
  const rect = (x0, y0, x1, y1, m) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, m)
  }
  const ellipse = (cx, cy, rx, ry, m, test = () => true) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy <= 1 && test(x, y)) put(x, y, m)
      }
  }
  const at = (x, y) => grid[y + Y]?.[x] ?? null
  return { put, rect, ellipse, at }
}

const HEAD = { cx: 11.5, cy: 9, rx: 6.6, ry: 6.4 }
const inHead = (x, y) => ((x - HEAD.cx) / HEAD.rx) ** 2 + ((y - HEAD.cy) / HEAD.ry) ** 2 <= 1

// Leg / arm offsets for the walk: frame 1 lifts the left foot, 2 the right.
const step = (frame) => (frame === 1 ? [2, 0] : frame === 2 ? [0, 2] : [0, 0])

function drawFrontBack(p, c, view, frame) {
  const back = view === 'back'
  const [liftL, liftR] = step(frame)

  // Long hair and capes fall behind the body.
  if (c.hairStyle === 'long' && c.hat !== 'hood') p.rect(4, 9, 19, back ? 20 : 18, 'hair')
  if (c.outfit === 'cloak' && !back) {
    p.rect(5, 16, 6, 27, 'accent')
    p.rect(17, 16, 18, 27, 'accent')
  }

  // Legs and boots.
  if (c.outfit !== 'robe' && c.outfit !== 'dress') {
    p.rect(9, 24, 10, 27 - liftL, 'pants')
    p.rect(13, 24, 14, 27 - liftR, 'pants')
  }
  p.rect(8, 28 - liftL, 10, 29 - liftL, 'boots')
  p.rect(13, 28 - liftR, 15, 29 - liftR, 'boots')

  // Torso.
  const o = c.outfit
  if (o === 'robe' || o === 'dress') {
    for (let y = 16; y <= 28; y++) {
      const spread = Math.floor((y - 16) / 4)
      p.rect(8 - spread, y, 15 + spread, y, 'cloth')
    }
    if (o === 'dress' && !back) p.rect(10, 18, 13, 26, 'accent')
    if (o === 'robe') p.rect(8, 22, 15, 22, 'belt')
  } else if (o === 'armor') {
    p.rect(8, 16, 15, 23, 'metal')
    if (!back) p.rect(11, 17, 12, 21, 'cloth')
    p.rect(8, 23, 15, 23, 'belt')
  } else {
    p.rect(8, 16, 15, 23, 'cloth')
    p.rect(8, 22, 15, 22, 'belt')
    if (!back && o === 'tunic') p.rect(11, 16, 12, 18, 'accent')
  }
  if (o === 'cloak') {
    if (back) p.rect(6, 16, 17, 27, 'accent')
    else {
      p.rect(6, 16, 17, 17, 'accent')
      p.put(11, 18, 'gold')
    }
  }

  // Arms swing opposite the legs.
  const armL = Math.sign(liftR - liftL)
  const sleeve = o === 'armor' ? 'metal' : 'cloth'
  p.rect(6, 17 + armL, 7, 22 + armL, sleeve)
  p.rect(16, 17 - armL, 17, 22 - armL, sleeve)
  p.rect(6, 23 + armL, 7, 24 + armL, 'skin')
  p.rect(16, 23 - armL, 17, 24 - armL, 'skin')
  if (o === 'armor') {
    p.rect(5, 16, 8, 17, 'metal')
    p.rect(15, 16, 18, 17, 'metal')
  }

  // Neck and head.
  p.rect(11, 15, 12, 15, 'skin')
  p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, 'skin')
  if (c.ears) {
    p.rect(4, 9, 5, 10, 'skin')
    p.put(3, 8, 'skin')
    p.rect(18, 9, 19, 10, 'skin')
    p.put(20, 8, 'skin')
  }

  // Hair.
  const hs = c.hairStyle
  if (back) {
    if (hs !== 'bald' && hs !== 'mohawk') p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, 'hair', (x, y) => y <= 14)
    if (hs === 'mohawk') p.rect(10, 1, 13, 14, 'hair')
    if (hs === 'ponytail') p.rect(10, 13, 13, 20, 'hair')
    if (hs === 'bob') p.rect(5, 9, 18, 14, 'hair')
  } else {
    if (hs === 'mohawk') p.rect(10, 1, 13, 6, 'hair')
    else if (hs !== 'bald') {
      p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, 'hair', (x, y) => y <= 6)
      // Bangs: a ragged fringe.
      for (let x = 6; x <= 17; x++) if (x % 3 !== 0 || hs === 'bob') p.put(x, 7, 'hair')
      if (hs === 'bob') p.rect(6, 8, 17, 8, 'hair')
      const sideTo = hs === 'long' ? 17 : hs === 'bob' ? 13 : 10
      p.rect(5, 6, 6, sideTo, 'hair')
      p.rect(17, 6, 18, sideTo, 'hair')
    }
    if (hs === 'spiky') {
      for (const [x, y] of [
        [7, 2],
        [10, 1],
        [13, 1],
        [16, 2],
        [11, 0],
        [5, 4],
        [18, 4],
      ])
        p.put(x, y, 'hair')
    }
    if (hs === 'ponytail') p.rect(18, 7, 20, 13, 'hair')
  }
  if (hs === 'bun') p.ellipse(11.5, 1.5, 2.5, 2, 'hair')

  // Face.
  if (!back) {
    const iris = 'eye'
    const lx = 8
    const rx = 15
    if (c.eyes === 'round') {
      p.rect(lx, 10, lx + 1, 11, 'pupil')
      p.rect(rx - 1, 10, rx, 11, 'pupil')
      p.put(lx + 1, 11, iris)
      p.put(rx - 1, 11, iris)
      p.put(lx, 10, 'white')
      p.put(rx - 1, 10, 'white')
    } else if (c.eyes === 'dot') {
      p.rect(lx + 1, 10, lx + 1, 11, 'pupil')
      p.rect(rx - 1, 10, rx - 1, 11, 'pupil')
    } else {
      p.rect(lx, 11, lx + 1, 11, 'pupil')
      p.rect(rx - 1, 11, rx, 11, 'pupil')
      p.put(lx + 1, 11, iris)
      p.put(rx - 1, 11, iris)
    }
    if (c.beard) {
      p.ellipse(HEAD.cx, 13.5, 5, 3, 'hair', (x, y) => y >= 12 && inHead(x, y + 1))
      p.rect(9, 15, 14, 16, 'hair')
      p.rect(11, 13, 12, 13, 'mouth')
    } else {
      p.rect(11, 13, 12, 13, 'mouth')
    }
    if (c.tusks) {
      p.put(10, 13, 'tusk')
      p.put(13, 13, 'tusk')
      p.put(10, 12, 'tusk')
      p.put(13, 12, 'tusk')
    }
  }

  // Horns.
  if (c.horns) {
    p.rect(5, 1, 6, 3, 'horn')
    p.put(5, 0, 'horn')
    p.put(4, -1, 'horn')
    p.rect(17, 1, 18, 3, 'horn')
    p.put(18, 0, 'horn')
    p.put(19, -1, 'horn')
  }

  drawHat(p, c, back)
  if (!back) drawGear(p, c, armL)
  else drawGearBack(p, c)
}

function drawHat(p, c, back) {
  switch (c.hat) {
    case 'hood':
      p.ellipse(HEAD.cx, HEAD.cy - 0.5, HEAD.rx + 1, HEAD.ry + 1, 'accent', (x, y) => back || !(y >= 7 && x >= 7 && x <= 16 && y <= 15))
      if (back) p.rect(8, 15, 15, 17, 'accent')
      break
    case 'wizard':
      p.rect(3, 4, 20, 4, 'accent')
      for (let y = -3; y <= 3; y++) {
        const half = Math.max(0, Math.floor((y + 4) * 0.8))
        p.rect(11 - half, y, 12 + half, y, 'accent')
      }
      p.put(14, -3, 'accent')
      p.put(15, -3, 'accent')
      if (!back) p.rect(9, 3, 14, 3, 'gold')
      break
    case 'helmet':
      p.ellipse(HEAD.cx, HEAD.cy - 1, HEAD.rx + 0.6, HEAD.ry, 'metal', (x, y) => y <= 6)
      if (!back) p.rect(11, 6, 12, 10, 'metal')
      break
    case 'headband':
      p.rect(5, 5, 18, 5, 'accent')
      break
    case 'crown':
      p.rect(6, 4, 17, 4, 'gold')
      for (const x of [7, 11, 12, 16]) p.put(x, 3, 'gold')
      if (!back) p.put(11, 4, 'gem')
      break
    default:
  }
}

// Weapon in the right hand (viewer's left), off-hand item on the left.
function drawGear(p, c, armL) {
  const hy = 23 + armL
  switch (c.weapon) {
    case 'sword':
      p.rect(4, hy - 10, 4, hy - 1, 'metal')
      p.rect(3, hy, 5, hy, 'gold')
      p.put(4, hy + 1, 'wood')
      break
    case 'staff':
      p.rect(4, hy - 14, 4, hy + 6, 'wood')
      p.ellipse(4, hy - 15, 1.2, 1.2, 'gem')
      break
    case 'axe':
      p.rect(4, hy - 8, 4, hy + 2, 'wood')
      p.rect(1, hy - 8, 3, hy - 5, 'metal')
      break
    case 'dagger':
      p.rect(4, hy - 4, 4, hy - 1, 'metal')
      p.put(4, hy, 'gold')
      break
    case 'bow':
      for (let y = -6; y <= 6; y++) p.put(3 - Math.round(Math.cos((y / 6) * 1.3) * 2) + 2, hy + y - 2, 'wood')
      p.rect(5, hy - 8, 5, hy + 4, 'white')
      break
    default:
  }
  const oy = 23 - armL
  switch (c.offhand) {
    case 'shield':
      p.ellipse(19, oy - 3, 2.6, 3.6, 'metal')
      p.ellipse(19, oy - 3, 1.2, 1.8, 'accent')
      break
    case 'book':
      p.rect(17, oy - 1, 20, oy + 2, 'accent')
      p.rect(18, oy, 20, oy + 1, 'white')
      break
    case 'lantern':
      p.put(19, oy, 'metal')
      p.rect(18, oy + 1, 20, oy + 3, 'metal')
      p.put(19, oy + 2, 'gem')
      break
    default:
  }
}

function drawGearBack(p, c) {
  // From behind you mostly see what's slung on the back.
  if (c.weapon === 'staff' || c.weapon === 'bow') {
    for (let i = 0; i < 14; i++) p.put(7 + Math.floor(i * 0.7), 13 + i, c.weapon === 'bow' ? 'wood' : 'wood')
  }
  if (c.weapon === 'sword' || c.weapon === 'axe') {
    for (let i = 0; i < 11; i++) p.put(16 - Math.floor(i * 0.6), 14 + i, i < 2 ? 'gold' : 'metal')
  }
  if (c.offhand === 'shield') p.ellipse(11.5, 20, 4, 4.5, 'metal')
}

// Facing right (left is this, mirrored).
function drawSide(p, c, frame) {
  const [liftL, liftR] = step(frame)
  const fwd = liftL ? 2 : liftR ? -2 : 0
  if (c.hairStyle === 'long' && c.hat !== 'hood') p.rect(6, 9, 11, 19, 'hair')
  if (c.outfit === 'cloak') p.rect(7, 16, 10, 27, 'accent')
  // Legs: one forward, one back while walking.
  if (c.outfit !== 'robe' && c.outfit !== 'dress') {
    p.rect(10 - fwd / 2, 24, 11 - fwd / 2, 27, 'pants')
    p.rect(12 + fwd / 2, 24, 13 + fwd / 2, 27, 'pants')
  }
  p.rect(9 - fwd / 2, 28, 11 - fwd / 2, 29, 'boots')
  p.rect(12 + fwd / 2, 28, 15 + fwd / 2, 29, 'boots')

  const o = c.outfit
  if (o === 'robe' || o === 'dress') {
    for (let y = 16; y <= 28; y++) {
      const spread = Math.floor((y - 16) / 5)
      p.rect(9 - spread, y, 14 + spread, y, 'cloth')
    }
  } else {
    p.rect(9, 16, 14, 23, o === 'armor' ? 'metal' : 'cloth')
    p.rect(9, o === 'armor' ? 23 : 22, 14, o === 'armor' ? 23 : 22, 'belt')
  }
  // The near arm swings with the step; the weapon is drawn now, so the
  // head passes in front of a tall staff instead of under it.
  const swing = fwd / 2
  sideWeapon(p, c, 13 + swing)
  p.rect(11 + swing, 17, 12 + swing, 22, o === 'armor' ? 'metal' : 'cloth')
  p.rect(11 + swing, 23, 12 + swing, 24, 'skin')
  p.rect(11, 15, 12, 15, 'skin')
  p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx - 0.4, HEAD.ry, 'skin')
  if (c.ears) {
    p.rect(9, 8, 10, 10, 'skin')
    p.put(8, 7, 'skin')
  }
  const hs = c.hairStyle
  if (hs === 'mohawk') p.rect(8, 1, 13, 5, 'hair')
  else if (hs !== 'bald') {
    p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx - 0.4, HEAD.ry, 'hair', (x, y) => y <= 6 || x <= 9 + (y > 11 ? 0 : 1))
    if (hs === 'spiky') for (const [x, y] of [[8, 1], [11, 0], [14, 1], [6, 3]]) p.put(x, y, 'hair')
    if (hs === 'long') p.rect(5, 9, 9, 17, 'hair')
    if (hs === 'bob') p.rect(5, 9, 9, 13, 'hair')
    if (hs === 'ponytail') p.rect(3, 7, 5, 14, 'hair')
    p.put(16, 7, 'hair')
    p.put(17, 7, 'hair')
  }
  if (hs === 'bun') p.ellipse(8, 2.5, 2.2, 2, 'hair')
  if (c.ears) p.rect(10, 9, 10, 10, 'skin')
  // Eye, mouth, nose.
  if (c.eyes === 'narrow') p.rect(15, 11, 16, 11, 'pupil')
  else p.rect(15, 10, 15, 11, 'pupil')
  if (c.eyes === 'round') p.put(16, 11, 'eye')
  p.put(18, 10, 'skin')
  if (c.beard) p.ellipse(14, 13.5, 4, 2.6, 'hair', (x, y) => y >= 12 && x >= 11 && inHead(x, y + 1))
  p.put(16, 13, 'mouth')
  if (c.tusks) p.put(16, 12, 'tusk')
  if (c.horns) {
    p.rect(9, 1, 10, 3, 'horn')
    p.put(9, 0, 'horn')
    p.put(8, -1, 'horn')
  }
  drawHat(p, c, false)
  if (c.hat === 'hood') p.ellipse(HEAD.cx, HEAD.cy - 0.5, HEAD.rx + 0.6, HEAD.ry + 1, 'accent', (x, y) => !(x >= 13 && y >= 7 && y <= 15))
  if (c.offhand === 'shield') p.ellipse(8, 20, 1.5, 3.5, 'metal')
}

function sideWeapon(p, c, hx) {
  const hy = 23
  if (c.weapon === 'sword') {
    p.rect(hx + 1, hy - 9, hx + 1, hy - 1, 'metal')
    p.rect(hx, hy, hx + 2, hy, 'gold')
  } else if (c.weapon === 'staff') {
    p.rect(hx + 1, hy - 14, hx + 1, hy + 6, 'wood')
    p.ellipse(hx + 1, hy - 15, 1.2, 1.2, 'gem')
  } else if (c.weapon === 'axe') {
    p.rect(hx + 1, hy - 8, hx + 1, hy + 2, 'wood')
    p.rect(hx + 2, hy - 8, hx + 4, hy - 5, 'metal')
  } else if (c.weapon === 'dagger') {
    p.rect(hx + 1, hy - 4, hx + 1, hy - 1, 'metal')
  } else if (c.weapon === 'bow') {
    for (let y = -6; y <= 6; y++) p.put(hx + 2 + Math.round(Math.cos((y / 6) * 1.3) * 2), hy + y - 2, 'wood')
  }
}

// ── Shading, outline, colour ─────────────────────────────────────────────
function materialColors(c) {
  const cloth = CLOTH[c.outfitColor] || CLOTH.teal
  const accent = CLOTH[c.accentColor] || CLOTH.umber
  const boots = CLOTH[c.bootsColor] || CLOTH.umber
  const pantsSet = c.outfit === 'armor' ? CLOTH.slate : [accent[1], shadeOf(accent[1]), accent[0]]
  return {
    skin: SKIN[c.skin] || SKIN.fair,
    hair: HAIR[c.hairColor] || HAIR.ember,
    cloth,
    accent,
    pants: pantsSet,
    boots: [boots[1], shadeOf(boots[1]), boots[0]],
    belt: [boots[1], shadeOf(boots[1]), boots[0]],
    eye: [EYE_COLORS[c.eyeColor] || EYE_COLORS.brown, EYE_COLORS[c.eyeColor] || EYE_COLORS.brown, EYE_COLORS[c.eyeColor] || EYE_COLORS.brown],
    pupil: ['#1a1210', '#1a1210', '#1a1210'],
    gold: CLOTH.gold,
    ...FIXED,
  }
}

function shadeOf(hex) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => Math.max(0, Math.round(v * 0.72))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`
}

const FLAT = new Set(['pupil', 'eye', 'white', 'mouth', 'gem'])

// The finished sprite as a grid of CSS colours (null = transparent).
export function renderSprite(config, view = 'front', frame = 0) {
  const c = { ...DEFAULT_SPRITE, ...config }
  const grid = canvasGrid()
  const p = painter(grid)
  if (view === 'left' || view === 'right') drawSide(p, c, frame)
  else drawFrontBack(p, c, view, frame)

  const colors = materialColors(c)
  const out = canvasGrid()
  const m = (x, y) => (y >= 0 && y < H && x >= 0 && x < W ? grid[y][x] : null)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const mat = grid[y][x]
      if (!mat) continue
      const [base, shade, light] = colors[mat] || ['#ff00ff', '#ff00ff', '#ff00ff']
      if (FLAT.has(mat)) {
        out[y][x] = base
        continue
      }
      // Light from the top-left: shade the bottom/right edges of each
      // material, highlight hair and metal on their top-left edges.
      const edgeBR = m(x + 1, y) !== mat || m(x, y + 1) !== mat
      const edgeTL = m(x - 1, y) !== mat || m(x, y - 1) !== mat
      if (edgeBR && !edgeTL) out[y][x] = shade
      else if (edgeTL && !edgeBR && (mat === 'hair' || mat === 'metal' || mat === 'gem')) out[y][x] = light
      else out[y][x] = base
    }
  }
  // Outline: every empty pixel touching the sprite.
  const filled = (x, y) => y >= 0 && y < H && x >= 0 && x < W && grid[y][x]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x]) continue
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) out[y][x] = OUTLINE
    }
  }
  // Soft shadow under the feet.
  for (let x = 6; x <= 17; x++) {
    for (const y of [30 + Y, 31 + Y]) {
      if (y < H && !out[y][x] && ((x - 11.5) / 6) ** 2 + ((y - 30.5 - Y) / 1.2) ** 2 <= 1) out[y][x] = SHADOW
    }
  }
  if (view === 'left') return out.map((row) => [...row].reverse())
  return out
}

export function drawToCanvas(ctx, grid, scale, ox = 0, oy = 0) {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const color = grid[y][x]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale)
    }
  }
}

export const VIEWS = ['front', 'right', 'back', 'left']
export const WALK = [1, 0, 2, 0]

// A PNG of one view (what's saved as the character's sprite), or a whole
// sheet (every view × walk frame) to download.
export function spriteBlob(config, { view = 'front', scale = 8 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  drawToCanvas(canvas.getContext('2d'), renderSprite(config, view, 0), scale)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export function sheetBlob(config, scale = 4) {
  const frames = [0, 1, 2]
  const canvas = document.createElement('canvas')
  canvas.width = W * scale * VIEWS.length
  canvas.height = H * scale * frames.length
  const ctx = canvas.getContext('2d')
  VIEWS.forEach((view, col) =>
    frames.forEach((frame, row) => drawToCanvas(ctx, renderSprite(config, view, frame), scale, col * W * scale, row * H * scale)),
  )
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
