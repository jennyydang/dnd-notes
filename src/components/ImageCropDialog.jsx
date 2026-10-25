import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import './ImageCropDialog.scss'

// Frame shapes offered in the dialog. `null` means "the image's own shape".
const ASPECTS = [
  { id: 'square', label: 'Square', value: 1 },
  { id: 'landscape', label: '4:3', value: 4 / 3 },
  { id: 'portrait', label: '3:4', value: 3 / 4 },
  { id: 'wide', label: '16:9', value: 16 / 9 },
  { id: 'original', label: 'Original', value: null },
]
const MIN_ZOOM = 0.3 // below 1 the whole image shrinks inside the frame
const MAX_ZOOM = 5
const MAX_OUTPUT = 1600 // px on the long edge — plenty for portraits/covers
const FRAME_MAX = 320

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // existing photos come from Supabase Storage (CORS-enabled)
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Couldn’t open that image.'))
    img.src = src
  })
}

// A copy of `img` turned 90° clockwise, as a new image.
async function rotated(img) {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalHeight
  canvas.height = img.naturalWidth
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(img, 0, 0)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  return loadImage(URL.createObjectURL(blob))
}

// The frame fits the dialog's width and the screen's height (leaving
// room for the controls), so the whole dialog stays on screen.
function frameSize(aspect, maxWidth, maxHeight) {
  const w = Math.min(FRAME_MAX * Math.max(1, aspect), maxWidth)
  let width = w
  let height = w / aspect
  const tallest = Math.min(FRAME_MAX * 1.25, maxHeight)
  if (height > tallest) {
    height = tallest
    width = height * aspect
  }
  return { width: Math.round(width), height: Math.round(height) }
}

// Height the title, slider, tools and buttons need around the frame.
const CONTROLS_HEIGHT = 330

// Crop / zoom / move / rotate an image before it's uploaded. Drag (or
// arrow keys) to move, pinch / scroll / the slider to zoom. Calls
// onDone(File) with the framed result, or onDone(original) for "Use as is".
function ImageCropDialog({
  source,
  fileName = 'image.jpg',
  aspect: initialAspect = 1,
  shape = 'rect',
  onCancel,
  onDone,
  onRemove, // optional: shows "Remove image" at the bottom left
}) {
  const [img, setImg] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [aspectId, setAspectId] = useState(
    () => ASPECTS.find((a) => a.value && Math.abs(a.value - initialAspect) < 0.01)?.id || 'original',
  )
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [maxWidth, setMaxWidth] = useState(FRAME_MAX)
  const [maxHeight, setMaxHeight] = useState(FRAME_MAX * 1.25)
  const wrapRef = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  // Load the picked file (or an existing photo's URL).
  useEffect(() => {
    let url = null
    let cancelled = false
    const src = typeof source === 'string' ? source : (url = URL.createObjectURL(source))
    loadImage(src)
      .then((loaded) => !cancelled && setImg(loaded))
      .catch((err) => !cancelled && setLoadError(err.message))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [source])

  // Size the frame to what's left of the screen once the title, slider,
  // tools and buttons (however they wrap) have taken their room, so the
  // whole dialog fits without scrolling.
  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current
      if (!wrap) return
      setMaxWidth(Math.min(wrap.clientWidth, 560))
      const stage = wrap.querySelector('.image-crop__stage')
      const panel = wrap.closest('.modal__panel')
      const controls = stage ? wrap.offsetHeight - stage.offsetHeight : CONTROLS_HEIGHT
      const panelPadding = panel ? panel.offsetHeight - panel.clientHeight + 2 * parseFloat(getComputedStyle(panel).paddingTop) : 48
      const viewport = window.visualViewport?.height || window.innerHeight
      const room = Math.max(140, Math.floor(viewport - controls - panelPadding - 48))
      setMaxHeight((h) => (Math.abs(h - room) > 4 ? room : h))
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [img, shape, aspectId])

  const aspectValue = ASPECTS.find((a) => a.id === aspectId)?.value || (img ? img.naturalWidth / img.naturalHeight : 1)
  const frame = frameSize(aspectValue, maxWidth, maxHeight)
  // Zoom 1 = the image just covers the frame.
  const baseScale = img ? Math.max(frame.width / img.naturalWidth, frame.height / img.naturalHeight) : 1
  const scale = baseScale * zoom
  const imgW = img ? img.naturalWidth * scale : 0
  const imgH = img ? img.naturalHeight * scale : 0

  // Keep the frame filled when zoomed in; keep the image inside the frame
  // when zoomed out.
  const clampOffset = useCallback(
    (o, w = imgW, h = imgH) => {
      const limitX = Math.abs(w - frame.width) / 2
      const limitY = Math.abs(h - frame.height) / 2
      return { x: clamp(o.x, -limitX, limitX), y: clamp(o.y, -limitY, limitY) }
    },
    [imgW, imgH, frame.width, frame.height],
  )

  function applyZoom(next) {
    const z = clamp(next, MIN_ZOOM, MAX_ZOOM)
    const ratio = z / zoom
    setZoom(z)
    if (img) {
      const s = baseScale * z
      setOffset((o) => clampOffset({ x: o.x * ratio, y: o.y * ratio }, img.naturalWidth * s, img.naturalHeight * s))
    }
  }

  function reset() {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  function changeAspect(id) {
    setAspectId(id)
    reset()
  }

  async function rotate() {
    if (!img) return
    setImg(await rotated(img))
    reset()
  }

  // ── Gestures ──
  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    startGesture()
  }

  function startGesture() {
    const pts = [...pointers.current.values()]
    if (pts.length === 1) gesture.current = { type: 'pan', start: pts[0], offset }
    if (pts.length === 2) {
      gesture.current = { type: 'pinch', distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom }
    }
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const pts = [...pointers.current.values()]
    if (g?.type === 'pan' && pts.length === 1) {
      setOffset(clampOffset({ x: g.offset.x + pts[0].x - g.start.x, y: g.offset.y + pts[0].y - g.start.y }))
    } else if (g?.type === 'pinch' && pts.length === 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      applyZoom(g.zoom * (d / g.distance))
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    startGesture()
  }

  function onWheel(e) {
    e.preventDefault()
    applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))
  }

  function onKeyDown(e) {
    const step = e.shiftKey ? 30 : 8
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[e.key]) {
      e.preventDefault()
      const [dx, dy] = moves[e.key]
      setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }))
    } else if (e.key === '+' || e.key === '=') {
      applyZoom(zoom * 1.1)
    } else if (e.key === '-') {
      applyZoom(zoom / 1.1)
    }
  }

  // React's onWheel is passive, so preventDefault needs a native listener.
  const stageRef = useRef(null)
  const wheelRef = useRef(onWheel)
  wheelRef.current = onWheel
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const handler = (e) => wheelRef.current(e)
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [img])

  async function apply() {
    if (!img) return
    setSaving(true)
    try {
      // As many pixels as the source has across the frame (no upscaling
      // past that), capped so the long edge stays under MAX_OUTPUT.
      const cap = aspectValue >= 1 ? MAX_OUTPUT : MAX_OUTPUT * aspectValue
      const width = Math.max(1, Math.round(clamp(frame.width / scale, Math.min(256, cap), cap)))
      const height = Math.max(1, Math.round(width / aspectValue))
      const k = width / frame.width
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.setTransform(k, 0, 0, k, 0, 0)
      const left = frame.width / 2 - imgW / 2 + offset.x
      const top = frame.height / 2 - imgH / 2 + offset.y
      ctx.drawImage(img, left, top, imgW, imgH)
      // Lossless here: the upload re-saves it once, as WebP (see
      // imageCompress.js), so it isn't compressed twice.
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) throw new Error('Couldn’t prepare the image.')
      const base = fileName.replace(/\.[^.]+$/, '') || 'image'
      onDone(new File([blob], `${base}.png`, { type: 'image/png' }))
    } catch (err) {
      setLoadError(err.message)
      setSaving(false)
    }
  }

  const imageStyle = img
    ? {
        width: imgW,
        height: imgH,
        transform: `translate(${frame.width / 2 - imgW / 2 + offset.x}px, ${frame.height / 2 - imgH / 2 + offset.y}px)`,
      }
    : undefined

  return (
    <Modal onClose={onCancel} label="Adjust image">
      <div className="image-crop" ref={wrapRef}>
        <h3 className="section-card__title">Adjust image</h3>
        {loadError && (
          <p className="field-error" role="alert">
            {loadError}
          </p>
        )}
        {!img && !loadError && <p className="empty-state">Opening image…</p>}
        {img && (
          <>
            <div
              ref={stageRef}
              className={`image-crop__stage image-crop__stage--${shape}`}
              style={{ width: frame.width, height: frame.height }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              tabIndex={0}
              role="application"
              aria-label="Image position. Drag or use arrow keys to move, plus and minus to zoom."
            >
              <img src={img.src} alt="" className="image-crop__image" style={imageStyle} draggable={false} />
              {shape === 'circle' && <div className="image-crop__circle" aria-hidden="true" />}
              <div className="image-crop__grid" aria-hidden="true" />
            </div>
            <p className="image-crop__hint">Drag to move · pinch, scroll or use the slider to resize</p>

            <div className="image-crop__zoom">
              <button type="button" className="image-crop__zoom-btn" onClick={() => applyZoom(zoom / 1.2)} aria-label="Smaller">
                −
              </button>
              <input
                type="range"
                // Log scale, so shrinking and enlarging get equal room.
                min={Math.log(MIN_ZOOM)}
                max={Math.log(MAX_ZOOM)}
                step="any"
                value={Math.log(zoom)}
                onChange={(e) => applyZoom(Math.exp(Number(e.target.value)))}
                aria-label="Size"
                aria-valuetext={`${Math.round(zoom * 100)}%`}
              />
              <button type="button" className="image-crop__zoom-btn" onClick={() => applyZoom(zoom * 1.2)} aria-label="Bigger">
                +
              </button>
            </div>

            <div className="image-crop__tools">
              {shape !== 'circle' && (
                <div className="chip-row" role="radiogroup" aria-label="Frame shape">
                  {ASPECTS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={aspectId === a.id}
                      className={`chip${aspectId === a.id ? ' chip--active' : ''}`}
                      onClick={() => changeAspect(a.id)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="image-crop__tool-buttons">
                <button type="button" className="btn btn--text" onClick={rotate}>
                  ⟳ Rotate
                </button>
                <button type="button" className="btn btn--text" onClick={reset}>
                  Reset
                </button>
              </div>
            </div>
          </>
        )}

        <div className="form-actions image-crop__actions">
          {onRemove && (
            <button type="button" className="btn btn--danger form-delete" onClick={onRemove} disabled={saving}>
              Remove image
            </button>
          )}
          <button type="button" className="btn btn--text" onClick={onCancel}>
            Cancel
          </button>
          {typeof source !== 'string' && (
            <button type="button" className="btn btn--text" onClick={() => onDone(source)} disabled={saving}>
              Use as is
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={apply} disabled={!img || saving}>
            {saving ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ImageCropDialog
