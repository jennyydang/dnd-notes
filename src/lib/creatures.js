import { removeImage, uploadImage } from './storage.js'

// Creatures (the party's and the DM's): suggested types and their photos.

// The standard 5e creature types, offered as suggestions (free text is fine).
export const CREATURE_TYPES = [
  'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental', 'Fey',
  'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead',
]

export const CREATURE_BUCKET = 'creature-photos'
export const MAX_CREATURE_PHOTOS = 12

// A creature's photos as stored: an array of storage paths.
export const photoList = (value) => (Array.isArray(value) ? value.filter((p) => typeof p === 'string' && p) : [])

// The form's working list: saved photos ({ path }) and newly picked ones
// ({ file, preview }), in order.
export const toPickerItems = (paths) => photoList(paths).map((path) => ({ path }))

// Uploads the new ones and returns the final list of paths, plus the
// saved photos that were removed (to delete once the row is saved).
export async function savePickerItems(items, previousPaths = []) {
  const paths = []
  for (const item of items) {
    paths.push(item.path || (await uploadImage(CREATURE_BUCKET, item.file)))
  }
  const removed = photoList(previousPaths).filter((p) => !paths.includes(p))
  return { paths, removed }
}

export async function deletePhotos(paths) {
  await Promise.all(photoList(paths).map((p) => removeImage(CREATURE_BUCKET, p).catch(() => {})))
}
