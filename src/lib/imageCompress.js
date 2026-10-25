// Shrinks a picture before it's uploaded, so storage goes further: it's
// scaled down to what its spot in the app can show (maps keep the most
// detail, for zooming) and re-saved as WebP, which is about a third
// lighter than JPEG at the same quality and keeps transparency. If the
// browser can't make WebP (older Safari), it falls back to JPEG, or PNG
// when the picture has see-through parts. The original is kept whenever
// it's already the lighter file at the same size.
const MAX_SIDE = {
  maps: 4096,
  'campaign-art': 2560,
  'player-backgrounds': 2560,
  'campaign-covers': 2048,
  'player-avatars': 1024,
}
const DEFAULT_SIDE = 1600 // portraits, loot, creatures, map pins
const QUALITY = 0.86
// Animated GIFs and SVGs (vector) would lose what makes them what they are.
const SHRINKABLE = /^image\/(jpeg|jpg|png|webp|bmp|avif|heic|heif|tiff)$/

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality))

function hasTransparency(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height)
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true
  return false
}

export function maxSideFor(bucket) {
  return MAX_SIDE[bucket] || DEFAULT_SIDE
}

export async function compressImage(file, bucket) {
  if (!SHRINKABLE.test(file.type || '') || typeof createImageBitmap !== 'function') return file
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file // a format this browser can't open: upload it as is
  }
  const scale = Math.min(1, maxSideFor(bucket) / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  let blob = await toBlob(canvas, 'image/webp', QUALITY)
  if (!blob || blob.type !== 'image/webp') {
    blob = hasTransparency(ctx, width, height)
      ? await toBlob(canvas, 'image/png')
      : await toBlob(canvas, 'image/jpeg', QUALITY)
  }
  if (!blob || (scale === 1 && blob.size >= file.size)) return file
  const ext = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }[blob.type]
  const base = (file.name || 'image').replace(/\.[^.]+$/, '') || 'image'
  return new File([blob], `${base}.${ext}`, { type: blob.type })
}
