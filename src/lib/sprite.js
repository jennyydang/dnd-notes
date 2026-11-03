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
const OUTLINE = '#120d16'
const SHADOW = 'rgba(0,0,0,0.38)'

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
  human: { label: 'Human', skin: 'tan', ears: false, horns: false, beard: false, tusks: false },
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
  skin: 'tan',
  hairStyle: 'short',
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
// Proportions follow classic 16-bit RPG field sprites: a big round head
// (nearly half the height), a short stubby body and tiny legs.
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
  return { put, rect, ellipse }
}

const HEAD = { cx: 11.5, cy: 9.5, rx: 7.6, ry: 7 }
const inHead = (x, y) => ((x - HEAD.cx) / HEAD.rx) ** 2 + ((y - HEAD.cy) / HEAD.ry) ** 2 <= 1
// Rows (before the hat room is added).
const EYE_Y = 11
const MOUTH = 14
const TOP = 17 // shoulders
const BELT = 21
const HAND = 21
const LEG = 23
const BOOT = 25

// Frame 1 lifts the left foot, 2 the right.
const step = (frame) => (frame === 1 ? [1, 0] : frame === 2 ? [0, 1] : [0, 0])

const SIDE_TO = { short: 12, spiky: 12, long: 20, bob: 15, ponytail: 12, bun: 12 }

// Chunky tufts on top of the head.
function spikes(p) {
  p.rect(6, 1, 7, 2, 'hair')
  p.rect(10, 0, 11, 2, 'hair')
  p.rect(13, 0, 14, 2, 'hair')
  p.rect(16, 1, 17, 2, 'hair')
}

function frontHair(p, hs) {
  if (hs === 'bald') return
  if (hs === 'mohawk') {
    p.rect(10, 0, 13, 8, 'hair')
    return
  }
  // A full mop: the crown, heavy bangs down to the eyes, and the sides.
  p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, 'hair', (x, y) => y <= 8)
  for (let x = 5; x <= 18; x++) p.put(x, 9, 'hair')
  for (const x of [5, 6, 8, 9, 11, 14, 15, 17, 18]) p.put(x, 10, 'hair')
  if (hs === 'bob') p.rect(5, 10, 18, 10, 'hair')
  const sideTo = SIDE_TO[hs] || 12
  p.rect(4, 7, 5, sideTo, 'hair')
  p.rect(18, 7, 19, sideTo, 'hair')
  if (hs === 'spiky') spikes(p)
  if (hs === 'ponytail') p.rect(20, 6, 21, 14, 'hair')
}

function drawFrontBack(p, c, view, frame) {
  const back = view === 'back'
  const [liftL, liftR] = step(frame)
  const armL = liftR - liftL
  const o = c.outfit
  const hs = c.hairStyle

  // Long hair and capes fall behind the body.
  if (hs === 'long' && c.hat !== 'hood') p.rect(3, 9, 20, 21, 'hair')

  // Legs and boots: short and stubby.
  if (o !== 'robe' && o !== 'dress') {
    p.rect(9, LEG - liftL, 10, BOOT - 1 - liftL, 'pants')
    p.rect(13, LEG - liftR, 14, BOOT - 1 - liftR, 'pants')
  }
  p.rect(8, BOOT - liftL, 10, BOOT + 1 - liftL, 'boots')
  p.rect(13, BOOT - liftR, 15, BOOT + 1 - liftR, 'boots')

  // Torso.
  if (o === 'robe' || o === 'dress') {
    for (let y = TOP; y <= BOOT; y++) {
      const spread = Math.floor((y - TOP) / 3)
      p.rect(8 - spread, y, 15 + spread, y, 'cloth')
    }
    if (o === 'dress' && !back) p.rect(10, TOP + 2, 13, BOOT - 1, 'accent')
    if (o === 'robe') p.rect(8, BELT, 15, BELT, 'belt')
  } else if (o === 'armor') {
    p.rect(8, TOP, 15, LEG - 1, 'metal')
    if (!back) p.rect(11, TOP + 1, 12, BELT - 1, 'cloth')
    p.rect(8, BELT + 1, 15, BELT + 1, 'belt')
  } else {
    p.rect(8, TOP, 15, LEG - 1, 'cloth')
    p.rect(8, BELT, 15, BELT, 'belt')
    if (!back && o === 'tunic') p.rect(11, TOP, 12, TOP + 1, 'accent')
  }

  // Arms hug the body and swing a little with the step.
  const sleeve = o === 'armor' ? 'metal' : 'cloth'
  p.rect(6, TOP + 1 + armL, 7, HAND - 1 + armL, sleeve)
  p.rect(16, TOP + 1 - armL, 17, HAND - 1 - armL, sleeve)
  p.rect(6, HAND + armL, 7, HAND + 1 + armL, 'skin')
  p.rect(16, HAND - armL, 17, HAND + 1 - armL, 'skin')
  if (o === 'armor') {
    p.rect(5, TOP, 8, TOP + 1, 'metal')
    p.rect(15, TOP, 18, TOP + 1, 'metal')
  }

  // A cloak drapes over the shoulders like a poncho.
  if (o === 'cloak') {
    for (let y = TOP; y <= BOOT - 1; y++) {
      const spread = Math.min(3, Math.floor((y - TOP) / 2))
      p.rect(7 - spread, y, 16 + spread, y, 'accent')
    }
    if (!back) {
      p.rect(11, TOP + 2, 12, BOOT - 1, 'cloth')
      p.put(11, TOP + 1, 'gold')
    }
  }

  // Head.
  p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, 'skin')
  if (c.ears) {
    p.rect(2, 10, 3, 11, 'skin')
    p.put(1, 9, 'skin')
    p.rect(20, 10, 21, 11, 'skin')
    p.put(22, 9, 'skin')
  }

  if (back) {
    if (hs !== 'bald' && hs !== 'mohawk') p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, 'hair')
    if (hs === 'mohawk') p.rect(10, 0, 13, 16, 'hair')
    if (hs === 'ponytail') p.rect(10, 15, 13, 22, 'hair')
    if (hs === 'bob') p.rect(4, 9, 19, 15, 'hair')
    if (hs === 'spiky') spikes(p)
  } else {
    frontHair(p, hs)
    // Small eyes, set low, just under the bangs.
    const iris = 'eye'
    if (c.eyes === 'round') {
      p.rect(8, EYE_Y, 8, EYE_Y + 1, 'pupil')
      p.rect(15, EYE_Y, 15, EYE_Y + 1, 'pupil')
      p.put(7, EYE_Y + 1, iris)
      p.put(16, EYE_Y + 1, iris)
    } else if (c.eyes === 'dot') {
      p.put(8, EYE_Y + 1, 'pupil')
      p.put(15, EYE_Y + 1, 'pupil')
    } else {
      p.rect(7, EYE_Y + 1, 8, EYE_Y + 1, 'pupil')
      p.rect(15, EYE_Y + 1, 16, EYE_Y + 1, 'pupil')
    }
    if (c.beard) {
      p.ellipse(HEAD.cx, 15.5, 5.5, 3.2, 'hair', (x, y) => y >= 13)
      p.rect(11, MOUTH, 12, MOUTH, 'mouth')
    } else {
      p.rect(11, MOUTH, 12, MOUTH, 'mouth')
    }
    if (c.tusks) {
      p.rect(10, MOUTH - 1, 10, MOUTH, 'tusk')
      p.rect(13, MOUTH - 1, 13, MOUTH, 'tusk')
    }
  }
  if (hs === 'bun') p.ellipse(11.5, 1.5, 2.5, 2, 'hair')

  if (c.horns) {
    p.rect(4, 2, 5, 4, 'horn')
    p.put(4, 1, 'horn')
    p.put(3, 0, 'horn')
    p.rect(18, 2, 19, 4, 'horn')
    p.put(19, 1, 'horn')
    p.put(20, 0, 'horn')
  }

  drawHat(p, c, back)
  if (!back) drawGear(p, c, armL)
  else drawGearBack(p, c)
}

function drawHat(p, c, back, side = false) {
  switch (c.hat) {
    case 'hood':
      p.ellipse(HEAD.cx, HEAD.cy - 0.5, HEAD.rx + 1, HEAD.ry + 1, 'accent', (x, y) =>
        back ? true : side ? !(x >= 13 && y >= 9 && y <= 16) : !(y >= 9 && x >= 6 && x <= 17 && y <= 16),
      )
      if (back) p.rect(7, 16, 16, 19, 'accent')
      break
    case 'wizard':
      p.rect(2, 3, 21, 3, 'accent')
      p.rect(4, 2, 19, 2, 'accent')
      for (let y = -3; y <= 1; y++) {
        const half = y + 4
        p.rect(Math.round(11.5 - half), y, Math.round(11.5 + half), y, 'accent')
      }
      p.rect(13, -4, 15, -4, 'accent')
      p.put(16, -3, 'accent')
      if (!back) p.rect(8, 1, 15, 1, 'gold')
      break
    case 'helmet':
      p.ellipse(HEAD.cx, HEAD.cy - 0.5, HEAD.rx + 0.6, HEAD.ry + 0.3, 'metal', (x, y) => y <= 8)
      if (!back && !side) p.rect(11, 8, 12, 12, 'metal')
      break
    case 'headband':
      p.rect(4, 6, 19, 6, 'accent')
      if (back) {
        p.put(11, 7, 'accent')
        p.put(12, 8, 'accent')
      }
      break
    case 'crown':
      p.rect(5, 4, 18, 4, 'gold')
      for (const x of [6, 11, 12, 17]) p.put(x, 3, 'gold')
      if (!back && !side) p.rect(11, 4, 12, 4, 'gem')
      break
    default:
  }
}

// Weapon in the right hand (viewer's left), off-hand item on the left.
function drawGear(p, c, armL) {
  const hy = HAND + armL
  switch (c.weapon) {
    case 'sword':
      p.rect(5, hy - 9, 5, hy - 1, 'metal')
      p.rect(4, hy, 6, hy, 'gold')
      p.put(5, hy + 1, 'wood')
      break
    case 'staff':
      p.rect(5, hy - 13, 5, hy + 5, 'wood')
      p.ellipse(5, hy - 14, 1.3, 1.3, 'gem')
      break
    case 'axe':
      p.rect(5, hy - 8, 5, hy + 2, 'wood')
      p.rect(2, hy - 8, 4, hy - 5, 'metal')
      break
    case 'dagger':
      p.rect(5, hy - 3, 5, hy - 1, 'metal')
      p.put(5, hy, 'gold')
      break
    case 'bow':
      for (let y = -6; y <= 6; y++) p.put(5 - Math.round(Math.cos((y / 6) * 1.3) * 2), hy + y - 1, 'wood')
      p.rect(5, hy - 7, 5, hy + 5, 'white')
      break
    default:
  }
  const oy = HAND - armL
  switch (c.offhand) {
    case 'shield':
      p.ellipse(19, oy - 2, 2.6, 3.4, 'metal')
      p.ellipse(19, oy - 2, 1.1, 1.6, 'accent')
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
  // From behind you mostly see what's slung across the back.
  if (c.weapon === 'staff' || c.weapon === 'bow') for (let i = 0; i < 11; i++) p.put(8 + Math.floor(i * 0.7), 16 + i * 0.8, 'wood')
  if (c.weapon === 'sword' || c.weapon === 'axe') for (let i = 0; i < 9; i++) p.put(15 - Math.floor(i * 0.6), 15 + i * 0.9, i < 2 ? 'gold' : 'metal')
  if (c.offhand === 'shield') p.ellipse(11.5, 20, 4, 3.6, 'metal')
}

// Facing right (left is this, mirrored).
function drawSide(p, c, frame) {
  const [liftL, liftR] = step(frame)
  const fwd = liftL ? 1 : liftR ? -1 : 0
  const o = c.outfit
  const hs = c.hairStyle
  if (hs === 'long' && c.hat !== 'hood') p.rect(4, 9, 11, 20, 'hair')
  if (o === 'cloak') p.rect(7, TOP, 10, BOOT - 1, 'accent')
  // One leg forward, one back while walking.
  if (o !== 'robe' && o !== 'dress') {
    p.rect(10 - fwd, LEG, 11 - fwd, BOOT - 1, 'pants')
    p.rect(12 + fwd, LEG, 13 + fwd, BOOT - 1, 'pants')
  }
  p.rect(9 - fwd, BOOT, 11 - fwd, BOOT + 1, 'boots')
  p.rect(12 + fwd, BOOT, 14 + fwd, BOOT + 1, 'boots')

  if (o === 'robe' || o === 'dress') {
    for (let y = TOP; y <= BOOT; y++) {
      const spread = Math.floor((y - TOP) / 4)
      p.rect(9 - spread, y, 14 + spread, y, 'cloth')
    }
  } else {
    p.rect(9, TOP, 14, LEG - 1, o === 'armor' ? 'metal' : 'cloth')
    p.rect(9, o === 'armor' ? BELT + 1 : BELT, 14, o === 'armor' ? BELT + 1 : BELT, 'belt')
  }
  sideWeapon(p, c, 13 + fwd)
  p.rect(11 + fwd, TOP + 1, 12 + fwd, HAND - 1, o === 'armor' ? 'metal' : 'cloth')
  p.rect(11 + fwd, HAND, 12 + fwd, HAND + 1, 'skin')
  if (o === 'cloak') p.rect(8, TOP, 13, TOP + 1, 'accent')

  p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx - 0.6, HEAD.ry, 'skin')
  p.put(19, 12, 'skin') // nose
  if (hs === 'mohawk') p.rect(8, 0, 12, 8, 'hair')
  else if (hs !== 'bald') {
    // Hair over the back and top of the head, bangs over the brow.
    p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx - 0.6, HEAD.ry, 'hair', (x, y) => y <= 9 || x <= 10)
    for (const x of [13, 14, 16, 17]) p.put(x, 10, 'hair')
    if (hs === 'spiky') {
      p.rect(7, 1, 8, 2, 'hair')
      p.rect(11, 0, 12, 2, 'hair')
      p.rect(15, 1, 16, 2, 'hair')
    }
    if (hs === 'bob') p.rect(4, 10, 10, 15, 'hair')
    if (hs === 'ponytail') p.rect(2, 7, 4, 14, 'hair')
  }
  if (hs === 'bun') p.ellipse(8, 1.5, 2.2, 2, 'hair')
  if (c.ears) {
    p.rect(9, 10, 10, 12, 'skin')
    p.put(8, 9, 'skin')
  }
  if (c.eyes === 'narrow') p.rect(16, EYE_Y + 1, 17, EYE_Y + 1, 'pupil')
  else if (c.eyes === 'dot') p.put(16, EYE_Y + 1, 'pupil')
  else {
    p.rect(16, EYE_Y, 16, EYE_Y + 1, 'pupil')
    p.put(17, EYE_Y + 1, 'eye')
  }
  if (c.beard) p.ellipse(15, 15.5, 4, 2.8, 'hair', (x, y) => y >= 13 && x >= 11)
  p.put(17, MOUTH, 'mouth')
  if (c.tusks) p.rect(17, MOUTH - 1, 17, MOUTH - 1, 'tusk')
  if (c.horns) {
    p.rect(9, 2, 10, 4, 'horn')
    p.put(9, 1, 'horn')
    p.put(8, 0, 'horn')
  }
  drawHat(p, c, false, true)
  if (c.offhand === 'shield') p.ellipse(8, 20, 1.5, 3, 'metal')
}

function sideWeapon(p, c, hx) {
  const hy = HAND
  if (c.weapon === 'sword') {
    p.rect(hx + 1, hy - 9, hx + 1, hy - 1, 'metal')
    p.rect(hx, hy, hx + 2, hy, 'gold')
  } else if (c.weapon === 'staff') {
    p.rect(hx + 1, hy - 13, hx + 1, hy + 5, 'wood')
    p.ellipse(hx + 1, hy - 14, 1.3, 1.3, 'gem')
  } else if (c.weapon === 'axe') {
    p.rect(hx + 1, hy - 8, hx + 1, hy + 2, 'wood')
    p.rect(hx + 2, hy - 8, hx + 4, hy - 5, 'metal')
  } else if (c.weapon === 'dagger') {
    p.rect(hx + 1, hy - 3, hx + 1, hy - 1, 'metal')
  } else if (c.weapon === 'bow') {
    for (let y = -6; y <= 6; y++) p.put(hx + 2 + Math.round(Math.cos((y / 6) * 1.3) * 2), hy + y - 1, 'wood')
  }
}

// ── Shading, outline, colour ─────────────────────────────────────────────
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (n, s) => (n >> s) & 255
  return `#${[16, 8, 0]
    .map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t).toString(16).padStart(2, '0'))
    .join('')}`
}
const shadeOf = (hex) => mix(hex, '#000000', 0.28)

function materialColors(c) {
  const cloth = CLOTH[c.outfitColor] || CLOTH.teal
  const accent = CLOTH[c.accentColor] || CLOTH.umber
  const boots = CLOTH[c.bootsColor] || CLOTH.umber
  const hair = HAIR[c.hairColor] || HAIR.ember
  const eye = EYE_COLORS[c.eyeColor] || EYE_COLORS.brown
  return {
    skin: SKIN[c.skin] || SKIN.fair,
    hair,
    shine: [mix(hair[2], '#ffe48a', 0.55)],
    cloth,
    accent,
    pants: c.outfit === 'armor' ? CLOTH.slate : [accent[1], shadeOf(accent[1]), accent[0]],
    boots: [boots[1], shadeOf(boots[1]), boots[0]],
    belt: [boots[1], shadeOf(boots[1]), boots[0]],
    eye: [eye],
    pupil: ['#140e12'],
    gold: CLOTH.gold,
    ...FIXED,
  }
}

const FLAT = new Set(['pupil', 'eye', 'white', 'mouth', 'gem', 'shine'])
// Big shapes get a 2-pixel shade on their right, like the reference art.
const WIDE_SHADE = new Set(['skin', 'hair', 'cloth', 'accent', 'metal'])

// The finished sprite as a grid of CSS colours (null = transparent).
export function renderSprite(config, view = 'front', frame = 0) {
  const c = { ...DEFAULT_SPRITE, ...config }
  const grid = canvasGrid()
  const p = painter(grid)
  const side = view === 'left' || view === 'right'
  if (side) drawSide(p, c, frame)
  else drawFrontBack(p, c, view, frame)

  // The shine streak across the hair: an arc on the upper-left of the head.
  const sx = HEAD.cx + (side ? -1 : -1.5)
  const sy = HEAD.cy + Y + 1.5
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== 'hair' || y > HEAD.cy + Y - 2) continue
      const d = Math.hypot((x - sx) / (HEAD.rx - 1.2), (y - sy) / (HEAD.ry - 0.6))
      if (d >= 0.74 && d <= 0.88 && x <= HEAD.cx + 3) grid[y][x] = 'shine'
    }

  const colors = materialColors(c)
  const out = canvasGrid()
  const m = (x, y) => (y >= 0 && y < H && x >= 0 && x < W ? grid[y][x] : null)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const mat = grid[y][x]
      if (!mat) continue
      const [base, shade = base, light = base] = colors[mat] || ['#ff00ff']
      if (FLAT.has(mat)) {
        out[y][x] = base
        continue
      }
      const same = (dx, dy) => {
        const n = m(x + dx, y + dy)
        return n === mat || (mat === 'hair' && n === 'shine')
      }
      // Light from the top-left: the bottom and right of each part are in
      // shade; hair and metal catch a highlight on their top-left edge.
      const edgeTL = !same(-1, 0) || !same(0, -1)
      const edgeBR = !same(1, 0) || !same(0, 1) || (WIDE_SHADE.has(mat) && !same(2, 0) && x > 1)
      // Bangs and hats cast a shadow on the forehead.
      const cast = mat === 'skin' && ['hair', 'shine', 'accent', 'metal'].includes(m(x, y - 1))
      if (cast || (edgeBR && !edgeTL)) out[y][x] = shade
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
  // A dark shadow under the feet.
  const fy = BOOT + 2 + Y
  for (let x = 5; x <= 18; x++) {
    for (const y of [fy, fy + 1]) {
      if (y < H && !out[y][x] && ((x - 11.5) / 6.5) ** 2 + ((y - fy - 0.4) / 1.3) ** 2 <= 1) out[y][x] = SHADOW
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
