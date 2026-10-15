import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { useDragReorder } from '../hooks/useDragReorder.js'
import { CampaignDataContext, useCampaignNav } from '../hooks/useCampaignData.js'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js'
import { getPlayerSession } from '../lib/auth.js'
import { getPublicUrl, removeImage, uploadImage } from '../lib/storage.js'
import { useImageCrop } from '../hooks/useImageCrop.jsx'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import MapLegend from './MapLegend.jsx'
import './WorldMapViewer.scss'

const MARKER_BUCKET = 'map-marker-photos'
const MAP_BUCKET = 'maps'
const ZOOM_MIN = 1
const ZOOM_MAX = 6
const DRAG_THRESHOLD_PX = 5
const LONG_PRESS_MS = 550 // hold this long (without moving) to ping
const DOUBLE_TAP_MS = 320

const emptyMarkerForm = {
  title: '',
  notes: '',
  photoFile: null,
  photoPreview: '',
  photoRemoved: false,
  category: 'event',
  entityKey: '', // 'npc:<id>' etc. — what this pin is about
}

// Pin types: the icon each shows and the map's filter chips.
const CATEGORIES = [
  { id: 'event', label: 'Event', icon: 'pushpin' },
  { id: 'town', label: 'Town', icon: 'home' },
  { id: 'dungeon', label: 'Dungeon', icon: 'monster' },
  { id: 'quest', label: 'Quest', icon: 'quest' },
  { id: 'danger', label: 'Danger', icon: 'alert' },
]
const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]
// Entries a pin can be about.
const LINKABLE = [
  { type: 'npc', label: 'NPCs' },
  { type: 'place', label: 'Places' },
  { type: 'quest', label: 'Quests' },
  { type: 'lore', label: 'Lore' },
]
const emptyZoomForm = { title: '', imageFile: null, imagePreview: '', editing: false }

const markerFromRow = (r) => ({
  id: r.id,
  x: r.x,
  y: r.y,
  title: r.title,
  notes: r.notes,
  kind: r.kind,
  category: r.category || 'event',
  sortOrder: r.sort_order ?? null,
  entityType: r.entity_type || null,
  entityId: r.entity_id || null,
  photoPath: r.photo_path,
  photo: getPublicUrl(MARKER_BUCKET, r.photo_path),
})

// Converts a raw `maps` row into the same shape MapsTab hands this
// component for a top-level map — used when a 'zoom' marker's nested map
// is fetched on demand, since it isn't loaded through MapsTab's own list.
const childMapFromRow = (r) => ({
  id: r.id,
  imagePath: r.image_path,
  src: getPublicUrl(MAP_BUCKET, r.image_path),
  caption: r.caption,
  pinX: r.pin_x,
  pinY: r.pin_y,
  sourceMarkerId: r.source_marker_id,
})

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// map is the { id, imagePath, src, caption, pinX, pinY, sourceMarkerId }
// row from MapsTab (or, for a nested zoom area, from childMapFromRow
// above). sourceMarkerId is only set for a nested zoom area's map — it's
// the map_markers row (on the *parent* map) that opens this one, and is
// what lets "Delete This Area" find its way back there.
//
// backLabel, when set, means this instance was opened from a 'zoom'
// marker on another map of that caption — the toolbar shows a "back"
// button instead of "Close", and onClose() just pops this level rather
// than leaving the World Map entirely. onDeleteSelf, set alongside it, is
// the parent's own removeItem bound to the marker that opened this map —
// routing the delete through the parent's hook (rather than this level
// deleting the marker directly) is what keeps the parent's marker list in
// sync, since it's a separate component instance with its own local state.
// onRenameSelf works the same way for the marker's title, and onUpdated
// tells the parent the new caption/image so this view refreshes.
// onRenameMap (top-level map only) renames it through MapsTab's hook.
function WorldMapViewer({ map, campaignId, focusMarkerId, onClose, backLabel, onDeleteSelf, onRenameSelf, onUpdated, onRenameMap }) {
  const { items: markers, addItem, updateItem, removeItem } =
    useSupabaseTable('map_markers', { fromRow: markerFromRow, filters: { map_id: map.id } })
  // This map's own row, live — so the party pin moves when anyone moves it.
  const { items: liveMapRows } = useSupabaseTable('maps', { filters: { id: map.id } })
  // Every place the party pin has been, oldest first: the journey trail.
  const pinMoves = useSupabaseTable('map_pin_moves', { filters: { map_id: map.id } })
  const campaignData = useContext(CampaignDataContext)
  const nav = useCampaignNav()
  const [showTrail, setShowTrail] = useState(true)
  const [trailPoint, setTrailPoint] = useState(null) // the trail dot whose label is showing

  // Zoom and pan as one value, so they always change together.
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const zoom = view.zoom
  const pan = { x: view.x, y: view.y }
  const [imgSize, setImgSize] = useState(null)
  // The viewport's size, so the map can be fitted and kept in view.
  const [box, setBox] = useState(null)
  // The shared pin's position lives in local state, seeded once from the
  // map row and updated only by our own drags/placements — there's no
  // realtime subscription in this app, so nothing else changes it out from
  // under us while this viewer is open (see movePin below: every write
  // already updates the canonical row, this just avoids waiting on that
  // round trip to show the new position).
  const [pin, setPin] = useState({ x: map.pinX, y: map.pinY })
  const [placementMode, setPlacementMode] = useState(null) // null | 'pin' (the party's first spot)
  const [pendingMarkerPos, setPendingMarkerPos] = useState(null)
  const [markerForm, setMarkerForm] = useState(null)
  const [editingMarkerId, setEditingMarkerId] = useState(null)
  const [detailsMarker, setDetailsMarker] = useState(null)
  const [zoomForm, setZoomForm] = useState(null)
  // The nested map opened by tapping a 'zoom' marker — rendering another
  // WorldMapViewer for it is what makes zoom areas recursively explorable.
  const [openZoomMap, setOpenZoomMap] = useState(null)
  const [formError, setFormError] = useState(null)
  // { kind: 'pin' | 'marker', id, x, y } while a pin/marker is being
  // dragged — the live position shown on screen during the gesture,
  // separate from the committed `pin` state / `markers` list.
  const [drag, setDrag] = useState(null)

  const viewportRef = useRef(null)
  const stageRef = useRef(null)
  const photoInputRef = useRef(null)
  const zoomImageInputRef = useRef(null)
  const objectUrlRef = useRef(null)
  const panStartRef = useRef(null)
  const dragStartRef = useRef(null)
  const activePointersRef = useRef(new Map())
  const pinchRef = useRef(null)
  const longPressRef = useRef(null)
  const lastTapRef = useRef(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function revokeTrackedObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  async function movePin(x, y) {
    const { error } = await supabase.from('maps').update({ pin_x: x, pin_y: y }).eq('id', map.id)
    if (error) throw new Error(error.message)
    // Add the stop to the journey trail (skipped quietly if the trail's
    // table hasn't been set up yet — the pin itself has already moved).
    try {
      await pinMoves.addItem({ x, y })
    } catch (err) {
      console.warn('Journey trail not saved:', err.message)
    }
  }

  async function clearTrail() {
    if (!window.confirm('Clear the party’s journey trail on this map? The pin stays where it is.')) return
    const { error } = await supabase.from('map_pin_moves').delete().eq('map_id', map.id)
    if (error) setFormError(error.message)
    setTrailPoint(null)
    pinMoves.refetch({ silent: true })
  }

  // Someone else moved the pin: follow it (it glides there, see the
  // anchor's transition) unless we're dragging it ourselves.
  const livePin = liveMapRows[0]
  useEffect(() => {
    if (!livePin || livePin.pin_x == null || dragStartRef.current) return
    setPin((current) =>
      current.x === livePin.pin_x && current.y === livePin.pin_y ? current : { x: livePin.pin_x, y: livePin.pin_y },
    )
  }, [livePin?.pin_x, livePin?.pin_y]) // eslint-disable-line react-hooks/exhaustive-deps

  // Entries a pin can be about, A→Z.
  const linkable = useMemo(
    () =>
      (campaignData?.entities || [])
        .filter((e) => LINKABLE.some((l) => l.type === e.type))
        .sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    [campaignData?.entities],
  )
  const linkedEntity = (marker) =>
    marker.entityType && campaignData ? campaignData.getEntity(marker.entityType, marker.entityId) : null

  // Filter chips: which pin types are hidden right now.
  const [hidden, setHidden] = useState(() => new Set())
  const typeOf = (marker) => (marker.kind === 'zoom' ? 'zoom' : marker.category)
  const presentTypes = [
    ...CATEGORIES.filter((c) => markers.some((m) => m.kind !== 'zoom' && m.category === c.id)),
    ...(markers.some((m) => m.kind === 'zoom') ? [{ id: 'zoom', label: 'Areas', icon: 'zoom' }] : []),
  ]
  const toggleType = (id) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Trail stops, each labelled with the session played that day (or the
  // date when there are no notes for it).
  const trail = useMemo(() => {
    const sessions = campaignData?.tables?.session?.items || []
    const titleByDay = new Map()
    for (const sess of sessions) if (sess.session_date) titleByDay.set(sess.session_date, sess.title || 'Session')
    return pinMoves.items.map((move) => {
      const when = new Date(move.created_at)
      const day = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`
      const label =
        titleByDay.get(day) || when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      return { id: move.id, x: move.x, y: move.y, label }
    })
  }, [pinMoves.items, campaignData?.tables?.session?.items])

  // The map's size at zoom 1: as large as fits inside the viewport
  // (whole map visible), keeping the image's shape.
  const aspect = imgSize ? imgSize.w / imgSize.h : 4 / 3
  const base = box
    ? box.w / box.h > aspect
      ? { w: box.h * aspect, h: box.h }
      : { w: box.w, h: box.w / aspect }
    : null

  // Keeps the map on screen: while it's smaller than the viewport it sits
  // centred; once bigger, its edges can't be dragged past the viewport's.
  function settle(next) {
    if (!box || !base) return next
    const fit = (offset, size, room) => (size <= room ? (room - size) / 2 : clamp(offset, room - size, 0))
    return {
      zoom: next.zoom,
      x: fit(next.x, base.w * next.zoom, box.w),
      y: fit(next.y, base.h * next.zoom, box.h),
    }
  }
  const settleRef = useRef(settle)
  settleRef.current = settle

  // Zooms so the map point under (pointX, pointY) — viewport coordinates —
  // stays under that same spot.
  function zoomAt(pointX, pointY, factor) {
    setView((prev) => {
      const newZoom = clamp(prev.zoom * factor, ZOOM_MIN, ZOOM_MAX)
      const stageX = (pointX - prev.x) / prev.zoom
      const stageY = (pointY - prev.y) / prev.zoom
      return settleRef.current({ zoom: newZoom, x: pointX - stageX * newZoom, y: pointY - stageY * newZoom })
    })
  }

  // Briefly animate the next view change (buttons, double-tap, overview).
  function glide(ms = 350) {
    setFlying(true)
    clearTimeout(glideTimer.current)
    glideTimer.current = setTimeout(() => setFlying(false), ms)
  }

  function zoomByFactor(factor) {
    const rect = viewportRef.current.getBoundingClientRect()
    glide()
    zoomAt(rect.width / 2, rect.height / 2, factor)
  }

  function resetView() {
    glide()
    setView(settle({ zoom: 1, x: 0, y: 0 }))
  }

  // Centre the view on a map fraction (the overview map's tap).
  function centreOn(fx, fy) {
    if (!base || !box) return
    glide()
    setView((prev) => settleRef.current({ zoom: prev.zoom, x: box.w / 2 - fx * base.w * prev.zoom, y: box.h / 2 - fy * base.h * prev.zoom }))
  }

  // Track the viewport's size (window resizes, rotating a tablet).
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Re-fit when the map first measures (or the screen changes size).
  useEffect(() => {
    setView((prev) => settleRef.current(prev))
  }, [box?.w, box?.h, imgSize?.w, imgSize?.h])

  // "Show on map": glide in on the requested pin and make it pulse.
  const [flying, setFlying] = useState(false)
  const [flashId, setFlashId] = useState(null)
  const flownTo = useRef(null)
  const flyTimers = useRef([])
  const glideTimer = useRef(null)
  useEffect(() => {
    if (!focusMarkerId || flownTo.current === focusMarkerId || !base || !box) return
    const target = markers.find((m) => m.id === focusMarkerId)
    if (!target) return
    flownTo.current = focusMarkerId
    setHidden((current) => (current.has(typeOf(target)) ? new Set() : current))
    flyTo(target, focusMarkerId)
  }, [focusMarkerId, markers, base?.w, base?.h, box?.w, box?.h]) // eslint-disable-line react-hooks/exhaustive-deps

  // Glide in on a map point (a pin), and pulse the pin with that key.
  function flyTo(point, flashKey) {
    if (!base || !box) return
    setFlying(true)
    setView((prev) => {
      const z = Math.max(prev.zoom, 2.5)
      return settleRef.current({ zoom: z, x: box.w / 2 - point.x * base.w * z, y: box.h / 2 - point.y * base.h * z })
    })
    if (flashKey) setFlashId(flashKey)
    // Not tied to an effect's cleanup: a live refresh mid-flight must not
    // cancel them (that would leave the pin pulsing for good).
    flyTimers.current.push(setTimeout(() => setFlying(false), 750))
    flyTimers.current.push(setTimeout(() => setFlashId(null), 3200))
  }

  // The pin list beside the map: hovering a card (or a pin) highlights
  // its partner. Under it sit the new pin / zoom area to drag in.
  const [showList, setShowList] = useState(true)
  // The map key; whether it's open is remembered on this device.
  const [showLegend, setShowLegend] = useState(() => {
    try {
      return localStorage.getItem('dnd-notes-map-legend') === '1'
    } catch {
      return false
    }
  })
  function toggleLegend(next = !showLegend) {
    setShowLegend(next)
    try {
      localStorage.setItem('dnd-notes-map-legend', next ? '1' : '0')
    } catch {
      // private mode: just don't remember
    }
  }
  const [hoverId, setHoverId] = useState(null) // 'party' or a marker id
  const listRef = useRef(null)
  useEffect(() => {
    // Hovering a pin scrolls its card into view.
    if (!hoverId || !listRef.current) return
    listRef.current.querySelector(`[data-pin="${hoverId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [hoverId])
  // Pins in list order: the creator / DM's arrangement, then the rest
  // newest first. A just-dropped order shows at once (optimistic).
  const [localOrder, setLocalOrder] = useState(null)
  const orderedMarkers = useMemo(() => {
    const age = new Map(markers.map((m, i) => [m.id, i])) // oldest first
    const saved = [...markers].sort((a, b) =>
      a.sortOrder != null || b.sortOrder != null
        ? (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)
        : age.get(b.id) - age.get(a.id),
    )
    if (!localOrder) return saved
    const rank = new Map(localOrder.map((id, i) => [id, i]))
    return [...saved].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
  }, [markers, localOrder])
  const listedMarkers = orderedMarkers.filter((marker) => !hidden.has(typeOf(marker)))
  const sortRef = useRef(null)
  const [orderError, setOrderError] = useState(null)
  const pinDrag = useDragReorder(async (id, toIndex) => {
    // Move within the cards shown (filters may hide some), then slot that
    // back into the full order and save each pin's new position.
    const shown = listedMarkers.map((m) => m.id)
    const from = shown.indexOf(id)
    const to = Math.max(0, Math.min(shown.length - 1, toIndex))
    if (from < 0 || from === to) return
    shown.splice(to, 0, shown.splice(from, 1)[0])
    const shownSet = new Set(shown)
    let next = 0
    const full = orderedMarkers.map((m) => (shownSet.has(m.id) ? shown[next++] : m.id))
    setLocalOrder(full)
    setOrderError(null)
    try {
      await Promise.all(
        full.map((markerId, index) => {
          const current = markers.find((m) => m.id === markerId)
          return current && current.sortOrder === index ? null : updateItem(markerId, { sort_order: index })
        }),
      )
    } catch (err) {
      setOrderError(`Couldn’t save the order: ${err.message}`)
    }
    setLocalOrder(null) // the saved order (or, on failure, the old one)
  })
  // A new pin goes to the top of the list (under the party): ahead of
  // any arranged pins, or — with none arranged — simply as the newest.
  function topOfList() {
    const ranked = markers.map((m) => m.sortOrder).filter((v) => v != null)
    return ranked.length ? { sort_order: Math.min(...ranked) - 1 } : {}
  }

  // Dragging a new pin or zoom area from under the list onto the map,
  // then confirming the spot, opens its form. A tap (or Enter) offers
  // the middle of what's on screen instead.
  const [newDrag, setNewDrag] = useState(null) // { kind, cx, cy, moved, over }
  const [confirmDrop, setConfirmDrop] = useState(null) // { kind, x, y }
  const paletteDragged = useRef(false)
  function overMap(cx, cy) {
    const r = viewportRef.current?.getBoundingClientRect()
    return Boolean(r) && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom
  }
  function paletteProps(kind) {
    return {
      onPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        paletteDragged.current = false
        setNewDrag({ kind, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, moved: false, over: false })
      },
      onPointerMove(e) {
        const { clientX: cx, clientY: cy } = e
        setNewDrag((d) => {
          if (!d) return d
          const moved = d.moved || Math.hypot(cx - d.sx, cy - d.sy) > DRAG_THRESHOLD_PX
          if (moved) paletteDragged.current = true
          return { ...d, cx, cy, moved, over: moved && overMap(cx, cy) }
        })
      },
      onPointerUp(e) {
        setNewDrag(null)
        if (paletteDragged.current && overMap(e.clientX, e.clientY)) {
          setConfirmDrop({ kind, ...computeFractionalPosition(e.clientX, e.clientY) })
        }
      },
      onPointerCancel: () => setNewDrag(null),
      onClick() {
        if (paletteDragged.current) return
        const r = viewportRef.current?.getBoundingClientRect()
        if (r) setConfirmDrop({ kind, ...computeFractionalPosition(r.left + r.width / 2, r.top + r.height / 2) })
      },
    }
  }
  function acceptDrop() {
    const { kind, x, y } = confirmDrop
    setConfirmDrop(null)
    beginNewMarker(kind, x, y)
  }

  const hoverProps = (key) => ({
    onMouseEnter: () => setHoverId(key),
    onMouseLeave: () => setHoverId((current) => (current === key ? null : current)),
  })
  useEffect(
    () => () => {
      flyTimers.current.forEach(clearTimeout)
      clearTimeout(glideTimer.current)
    },
    [],
  )

  // Ping: hold a spot to send a pulsing ripple to everyone on this map
  // (a Realtime broadcast — nothing is saved).
  const [pings, setPings] = useState([])
  const pingChannel = useRef(null)
  function showPing(ping) {
    const id = `${Date.now()}-${Math.random()}`
    setPings((current) => [...current, { ...ping, id }])
    setTimeout(() => setPings((current) => current.filter((p) => p.id !== id)), 2800)
  }
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    const channel = supabase
      .channel(`map-ping:${map.id}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'ping' }, ({ payload }) => {
        if (payload && typeof payload.x === 'number') showPing(payload)
      })
      .subscribe()
    pingChannel.current = channel
    return () => {
      pingChannel.current = null
      supabase.removeChannel(channel)
    }
  }, [map.id])
  function sendPing(x, y) {
    const ping = { x, y, name: getPlayerSession()?.username || 'The DM' }
    showPing(ping)
    navigator.vibrate?.(15)
    pingChannel.current?.send({ type: 'broadcast', event: 'ping', payload: ping })
  }


  // Native (non-passive) listener: React's onWheel is passive and can't
  // preventDefault, which we need to stop the page itself from scrolling.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.001))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Converts a pointer client position into a 0..1 fraction of the
  // stage's own (untransformed) size — offsetWidth/offsetHeight reflect
  // the element's CSS layout box and are unaffected by the transform:
  // scale() applied to it, unlike getBoundingClientRect().
  function computeFractionalPosition(clientX, clientY) {
    const viewportRect = viewportRef.current.getBoundingClientRect()
    const pointX = clientX - viewportRect.left
    const pointY = clientY - viewportRect.top
    const stageWidth = stageRef.current.offsetWidth
    const stageHeight = stageRef.current.offsetHeight
    return {
      x: clamp((pointX - pan.x) / zoom / stageWidth, 0, 1),
      y: clamp((pointY - pan.y) / zoom / stageHeight, 0, 1),
    }
  }

  function handleStagePointerDown(e) {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    e.currentTarget.setPointerCapture(e.pointerId)

    if (activePointersRef.current.size === 2) {
      clearTimeout(longPressRef.current)
      panStartRef.current = null
      const pts = [...activePointersRef.current.values()]
      pinchRef.current = {
        initialDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        initialZoom: zoom,
        initialPan: pan,
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      }
      return
    }

    const start = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      moved: false,
      pinged: false,
    }
    panStartRef.current = start
    // Hold still to ping that spot (not while placing a pin or marker).
    clearTimeout(longPressRef.current)
    if (!placementMode) {
      const { clientX, clientY } = e
      longPressRef.current = setTimeout(() => {
        if (panStartRef.current !== start || start.moved || activePointersRef.current.size !== 1) return
        start.pinged = true
        const { x, y } = computeFractionalPosition(clientX, clientY)
        sendPing(x, y)
      }, LONG_PRESS_MS)
    }
  }

  function handleStagePointerMove(e) {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    if (activePointersRef.current.size === 2 && pinchRef.current) {
      const pts = [...activePointersRef.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const scale = dist / pinchRef.current.initialDist
      const newZoom = clamp(pinchRef.current.initialZoom * scale, ZOOM_MIN, ZOOM_MAX)
      const viewportRect = viewportRef.current.getBoundingClientRect()
      const pointX = pinchRef.current.mid.x - viewportRect.left
      const pointY = pinchRef.current.mid.y - viewportRect.top
      const stageX = (pointX - pinchRef.current.initialPan.x) / pinchRef.current.initialZoom
      const stageY = (pointY - pinchRef.current.initialPan.y) / pinchRef.current.initialZoom
      setView(settle({ zoom: newZoom, x: pointX - stageX * newZoom, y: pointY - stageY * newZoom }))
      return
    }

    const start = panStartRef.current
    if (!start) return
    const dx = e.clientX - start.startClientX
    const dy = e.clientY - start.startClientY
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) start.moved = true
    setView((prev) => settle({ zoom: prev.zoom, x: start.startPanX + dx, y: start.startPanY + dy }))
  }

  function handleStagePointerUp(e) {
    activePointersRef.current.delete(e.pointerId)
    if (activePointersRef.current.size < 2) pinchRef.current = null

    clearTimeout(longPressRef.current)
    const start = panStartRef.current
    panStartRef.current = null
    if (!start || start.moved || start.pinged) return
    if (!placementMode) {
      // Double-tap (or double-click) zooms in on that spot.
      const now = Date.now()
      const last = lastTapRef.current
      if (last && now - last.at < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
        lastTapRef.current = null
        const rect = viewportRef.current.getBoundingClientRect()
        glide()
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, 2)
      } else {
        lastTapRef.current = { at: now, x: e.clientX, y: e.clientY }
      }
      return
    }

    const { x, y } = computeFractionalPosition(e.clientX, e.clientY)
    if (placementMode === 'pin') {
      setPin({ x, y })
      setPlacementMode(null)
      movePin(x, y).catch((err) => setFormError(err.message))
    }
  }

  // Open the form for a new pin ('event') or zoom area at a map point.
  function beginNewMarker(kind, x, y) {
    setPendingMarkerPos({ x, y })
    revokeTrackedObjectUrl()
    setFormError(null)
    if (kind === 'zoom') {
      setZoomForm(emptyZoomForm)
    } else {
      setMarkerForm(emptyMarkerForm)
      setEditingMarkerId(null)
    }
  }

  function startDrag(e, kind, id, initialX, initialY) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = {
      kind,
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: initialX,
      startY: initialY,
      moved: false,
    }
    setDrag({ kind, id, x: initialX, y: initialY })
  }

  function moveDrag(e) {
    const start = dragStartRef.current
    if (!start) return
    e.stopPropagation()
    const stageWidth = stageRef.current.offsetWidth
    const stageHeight = stageRef.current.offsetHeight
    const dxScreen = e.clientX - start.startClientX
    const dyScreen = e.clientY - start.startClientY
    if (Math.hypot(dxScreen, dyScreen) > DRAG_THRESHOLD_PX) start.moved = true
    const newX = clamp(start.startX + dxScreen / zoom / stageWidth, 0, 1)
    const newY = clamp(start.startY + dyScreen / zoom / stageHeight, 0, 1)
    setDrag({ kind: start.kind, id: start.id, x: newX, y: newY })
  }

  // A tap (no drag) on an existing marker opens its popup: an 'event'
  // marker shows the title/notes/photo details, a 'zoom' marker instead
  // fetches and opens the nested map it points to.
  async function openZoomArea(marker) {
    const { data, error } = await supabase
      .from('maps')
      .select('*')
      .eq('source_marker_id', marker.id)
      .single()
    if (error) {
      console.error(error.message)
      return
    }
    setOpenZoomMap(childMapFromRow(data))
  }

  async function endDrag(e) {
    const start = dragStartRef.current
    dragStartRef.current = null
    if (!start) return
    e.stopPropagation()

    if (!start.moved) {
      setDrag(null)
      if (start.kind === 'marker') {
        const marker = markers.find((m) => m.id === start.id)
        if (marker) {
          if (marker.kind === 'zoom') openZoomArea(marker)
          else setDetailsMarker(marker)
        }
      }
      return
    }

    const final = { x: drag?.x ?? start.startX, y: drag?.y ?? start.startY }
    if (start.kind === 'pin') {
      // Update local state immediately (no flash), then persist.
      setPin(final)
      setDrag(null)
      try {
        await movePin(final.x, final.y)
      } catch (err) {
        setFormError(err.message)
      }
    } else {
      // Keep showing the drag position until the committed list actually
      // reflects it (updateItem awaits its own refetch before resolving),
      // so clearing `drag` here never causes a flash back to the old spot.
      try {
        await updateItem(start.id, { x: final.x, y: final.y })
      } catch (err) {
        setFormError(err.message)
      } finally {
        setDrag(null)
      }
    }
  }

  function openEditForm(marker) {
    revokeTrackedObjectUrl()
    setMarkerForm({
      title: marker.title,
      notes: marker.notes,
      photoFile: null,
      photoPreview: marker.photo || '',
      photoRemoved: false,
      category: marker.category,
      entityKey: marker.entityType ? `${marker.entityType}:${marker.entityId}` : '',
    })
    setEditingMarkerId(marker.id)
    setPendingMarkerPos(null)
    setFormError(null)
    setDetailsMarker(null)
  }

  function cancelMarkerForm() {
    revokeTrackedObjectUrl()
    setMarkerForm(null)
    setEditingMarkerId(null)
    setPendingMarkerPos(null)
    setFormError(null)
  }

  // Every picked photo goes through the crop/zoom/move step first.
  const photoCrop = useImageCrop({ aspect: 4 / 3, shape: 'rect', onCropped: applyMarkerPhoto, onRemove: removeMarkerPhoto })

  function applyMarkerPhoto(file) {

    revokeTrackedObjectUrl()
    const previewUrl = URL.createObjectURL(file)
    objectUrlRef.current = previewUrl
    setMarkerForm((prev) => ({ ...prev, photoFile: file, photoPreview: previewUrl, photoRemoved: false }))
  }

  function removeMarkerPhoto() {
    revokeTrackedObjectUrl()
    setMarkerForm((prev) => ({ ...prev, photoFile: null, photoPreview: '', photoRemoved: true }))
  }

  async function submitMarkerForm(event) {
    event.preventDefault()
    if (!markerForm.title.trim()) return

    const payload = { title: markerForm.title, notes: markerForm.notes }
    // Type and link are only sent when used (or being cleared), so a
    // database without those columns yet still saves plain pins.
    const editing = editingMarkerId ? markers.find((m) => m.id === editingMarkerId) : null
    if (markerForm.category !== 'event' || (editing && editing.category !== 'event')) payload.category = markerForm.category
    if (markerForm.entityKey) {
      const [entityType, entityId] = markerForm.entityKey.split(':')
      payload.entity_type = entityType
      payload.entity_id = entityId
    } else if (editing?.entityType) {
      payload.entity_type = null
      payload.entity_id = null
    }

    try {
      if (markerForm.photoFile) {
        payload.photo_path = await uploadImage(MARKER_BUCKET, markerForm.photoFile)
      } else if (markerForm.photoRemoved) {
        payload.photo_path = null
      }

      if (editingMarkerId) {
        await updateItem(editingMarkerId, payload)
      } else {
        await addItem({ ...payload, ...topOfList(), x: pendingMarkerPos.x, y: pendingMarkerPos.y, kind: 'event' })
      }
      cancelMarkerForm()
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function deleteMarker(marker) {
    await removeItem(marker.id)
    await removeImage(MARKER_BUCKET, marker.photoPath)
    setDetailsMarker(null)
    if (editingMarkerId === marker.id) cancelMarkerForm()
  }

  function cancelZoomForm() {
    revokeTrackedObjectUrl()
    setZoomForm(null)
    setPendingMarkerPos(null)
    setFormError(null)
  }

  function handleZoomImageSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    revokeTrackedObjectUrl()
    const previewUrl = URL.createObjectURL(file)
    objectUrlRef.current = previewUrl
    setZoomForm((prev) => ({ ...prev, imageFile: file, imagePreview: previewUrl }))
  }

  async function renameThisMap() {
    const name = window.prompt('Rename this map', map.caption || '')
    if (name === null || name.trim() === (map.caption || '')) return
    try {
      await onRenameMap(name)
    } catch (err) {
      setFormError(err.message)
    }
  }

  // Editing the zoom area you're inside: rename it and/or swap its image.
  function startEditingZoomArea() {
    revokeTrackedObjectUrl()
    setFormError(null)
    setZoomForm({ title: map.caption || '', imageFile: null, imagePreview: map.src, editing: true })
  }

  async function saveZoomAreaEdits() {
    const title = zoomForm.title.trim()
    let newPath = null
    try {
      const patch = { caption: title }
      if (zoomForm.imageFile) {
        newPath = await uploadImage(MAP_BUCKET, zoomForm.imageFile)
        patch.image_path = newPath
      }
      const { error: updateError } = await supabase.from('maps').update(patch).eq('id', map.id)
      if (updateError) throw new Error(updateError.message)
      await onRenameSelf?.(title)
      if (newPath) await removeImage(MAP_BUCKET, map.imagePath)
      onUpdated?.({
        caption: title,
        ...(newPath ? { imagePath: newPath, src: getPublicUrl(MAP_BUCKET, newPath) } : {}),
      })
      cancelZoomForm()
    } catch (err) {
      if (newPath) await removeImage(MAP_BUCKET, newPath)
      setFormError(err.message)
    }
  }

  // Placing a zoom area is a two-table write: the marker on this map, and
  // the nested map row it points to (see supabase/schema.sql). If the
  // second insert fails, roll back the marker and the uploaded image
  // rather than leaving a zoom marker that opens nothing.
  async function submitZoomForm(event) {
    event.preventDefault()
    if (zoomForm.editing) {
      if (zoomForm.title.trim()) await saveZoomAreaEdits()
      return
    }
    if (!zoomForm.title.trim() || !zoomForm.imageFile) return

    let imagePath = null
    let marker = null
    try {
      imagePath = await uploadImage(MAP_BUCKET, zoomForm.imageFile)
      marker = await addItem({ title: zoomForm.title, ...topOfList(), x: pendingMarkerPos.x, y: pendingMarkerPos.y, kind: 'zoom' })
      const { error: childMapError } = await supabase
        .from('maps')
        .insert({ campaign_id: campaignId, image_path: imagePath, caption: zoomForm.title, source_marker_id: marker.id })
      if (childMapError) throw new Error(childMapError.message)
      cancelZoomForm()
    } catch (err) {
      if (marker) await removeItem(marker.id)
      if (imagePath) await removeImage(MAP_BUCKET, imagePath)
      setFormError(err.message)
    }
  }

  // Only shown for a nested zoom area (onDeleteSelf set) — deletes the
  // marker on the *parent* map via the parent's own removeItem, which
  // cascades (see schema.sql) to delete this map row and everything
  // nested under it; only this map's own image needs explicit storage
  // cleanup here.
  async function deleteZoomArea() {
    try {
      await onDeleteSelf()
    } catch (err) {
      setFormError(err.message)
      return
    }
    await removeImage(MAP_BUCKET, map.imagePath)
    onClose()
  }

  const pinPos = drag?.kind === 'pin' ? drag : pin

  return (
    <div className="world-map-viewer" role="dialog" aria-modal="true" aria-label={map.caption || 'Interactive Map'}>
      <div className="world-map-viewer__toolbar">
        <span className="world-map-viewer__title">{map.caption || 'Interactive Map'}</span>
        <div className="world-map-viewer__controls">
          <button type="button" className="btn btn--text" onClick={() => zoomByFactor(1.25)} aria-label="Zoom in">
            +
          </button>
          <button type="button" className="btn btn--text" onClick={() => zoomByFactor(0.8)} aria-label="Zoom out">
            &minus;
          </button>
          <button type="button" className="btn btn--text" onClick={resetView}>
            Reset
          </button>
          <button
            type="button"
            className={`btn btn--text${showList ? ' is-on' : ''}`}
            onClick={() => setShowList((v) => !v)}
            aria-pressed={showList}
          >
            <Icon name="rows" /> Pins
          </button>
          <button
            type="button"
            className={`btn btn--text${showLegend ? ' is-on' : ''}`}
            onClick={() => toggleLegend()}
            aria-pressed={showLegend}
          >
            <Icon name="map" /> Legend
          </button>
          {trail.length > 0 && (
            <>
              <button
                type="button"
                className={`btn btn--text${showTrail ? ' is-on' : ''}`}
                onClick={() => setShowTrail((v) => !v)}
                aria-pressed={showTrail}
              >
                <Icon name="trend" /> Journey
              </button>
              {showTrail && (
                <button type="button" className="btn btn--text" onClick={clearTrail}>
                  Clear trail
                </button>
              )}
            </>
          )}
          {pin.x == null && (
            <button
              type="button"
              className="btn btn--text"
              onClick={() => setPlacementMode((m) => (m === 'pin' ? null : 'pin'))}
            >
              {placementMode === 'pin' ? 'Click the map to drop your pin' : 'Drop "I am here" pin'}
            </button>
          )}
          {onRenameSelf && (
            <button type="button" className="btn btn--text" onClick={startEditingZoomArea}>
              Edit This Area
            </button>
          )}
          {onRenameMap && (
            <button type="button" className="btn btn--text" onClick={renameThisMap}>
              <Icon name="edit" /> Rename Map
            </button>
          )}
          {onDeleteSelf && (
            <button type="button" className="btn btn--danger" onClick={deleteZoomArea}>
              Delete This Area
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {backLabel ? `← Back to ${backLabel}` : 'Close'}
          </button>
        </div>
      </div>

      {presentTypes.length > 1 && (
        <div className="world-map-viewer__filters" role="group" aria-label="Show pins">
          {presentTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip world-map-viewer__filter${hidden.has(t.id) ? '' : ' chip--active'}`}
              aria-pressed={!hidden.has(t.id)}
              onClick={() => toggleType(t.id)}
            >
              <Icon name={t.icon} /> {t.label}
            </button>
          ))}
        </div>
      )}

      <div className={`world-map-viewer__body${showList ? ' world-map-viewer__body--list' : ''}`}>
      <div
        className={`world-map-viewer__viewport${placementMode ? ' world-map-viewer__viewport--placing' : ''}${hoverId ? ' world-map-viewer__viewport--hovering' : ''}${newDrag?.over ? ' world-map-viewer__viewport--drop' : ''}`}
        ref={viewportRef}
      >
        <div
          className="world-map-viewer__stage"
          ref={stageRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: flying ? 'transform 0.7s cubic-bezier(0.3, 0.7, 0.2, 1)' : undefined,
            width: base ? base.w : '100%',
            height: base ? base.h : undefined,
            aspectRatio: base ? undefined : `${aspect}`,
          }}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
        >
          <img
            src={map.src}
            alt={map.caption || 'Interactive map'}
            draggable={false}
            onLoad={(e) => setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          />

          {/* The party's journey: a dotted line through every stop, ending
              at the pin. Tap a stop to see which session it was. */}
          {showTrail && trail.length > 0 && (
            <>
              <svg className="world-map-viewer__trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline
                  points={[...trail, ...(pin.x != null ? [pinPos] : [])].map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {trail.map((stop, index) => (
                <div
                  key={stop.id}
                  className="world-map-viewer__anchor world-map-viewer__anchor--trail"
                  style={{ left: `${stop.x * 100}%`, top: `${stop.y * 100}%` }}
                >
                  <button
                    type="button"
                    className={`world-map-viewer__trail-stop${trailPoint === stop.id ? ' is-open' : ''}`}
                    style={{ transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setTrailPoint((open) => (open === stop.id ? null : stop.id))}
                    aria-label={`Stop ${index + 1}: ${stop.label}`}
                  >
                    {trailPoint === stop.id && (
                      <span className="world-map-viewer__trail-label">
                        {index + 1}. {stop.label}
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </>
          )}

          {pings.map((ping) => (
            <div
              key={ping.id}
              className="world-map-viewer__anchor"
              style={{ left: `${ping.x * 100}%`, top: `${ping.y * 100}%` }}
            >
              <div className="world-map-viewer__ping" style={{ transform: `scale(${1 / zoom})` }} aria-hidden="true">
                <span />
                <span />
                <span />
                <em>{ping.name}</em>
              </div>
            </div>
          ))}

          {pin.x != null && (
            <div
              className={`world-map-viewer__anchor world-map-viewer__anchor--glide${drag?.kind === 'pin' ? ' is-dragging' : ''}`}
              style={{ left: `${pinPos.x * 100}%`, top: `${pinPos.y * 100}%` }}
            >
              <div
                className={`world-map-viewer__pin${hoverId === 'party' ? ' is-hovered' : ''}${flashId === 'party' ? ' is-focused' : ''}`}
                {...hoverProps('party')}
                style={{ transform: `translate(-50%, -100%) scale(${1 / zoom})` }}
                onPointerDown={(e) => startDrag(e, 'pin', null, pin.x, pin.y)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                title="Drag to update the party's location"
              >
                <Icon name="pin" />
              </div>
            </div>
          )}

          {(() => {
            const at = confirmDrop || ((markerForm && !editingMarkerId) || (zoomForm && !zoomForm.editing) ? pendingMarkerPos : null)
            if (!at) return null
            const isZoom = confirmDrop ? confirmDrop.kind === 'zoom' : Boolean(zoomForm)
            return (
              <div className="world-map-viewer__anchor" style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}>
                <div
                  className={`${isZoom ? 'world-map-viewer__zoom-marker' : 'world-map-viewer__event-marker'} world-map-viewer__new-marker`}
                  style={{ transform: `translate(-50%, -100%) scale(${1 / zoom})` }}
                >
                  <Icon name={isZoom ? 'zoom' : 'pushpin'} />
                </div>
              </div>
            )
          })()}

          {markers.filter((marker) => !hidden.has(typeOf(marker))).map((marker) => {
            const pos = drag?.kind === 'marker' && drag.id === marker.id ? drag : marker
            const isZoom = marker.kind === 'zoom'
            const entity = linkedEntity(marker)
            // An active quest's pin glows gold.
            const activeQuest = entity?.type === 'quest' && entity.open
            const classes = [
              isZoom ? 'world-map-viewer__zoom-marker' : 'world-map-viewer__event-marker',
              !isZoom && `world-map-viewer__event-marker--${marker.category}`,
              activeQuest && 'is-active-quest',
              flashId === marker.id && 'is-focused',
              hoverId === marker.id && 'is-hovered',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <div
                key={marker.id}
                className={`world-map-viewer__anchor world-map-viewer__anchor--glide${drag?.id === marker.id ? ' is-dragging' : ''}${hoverId === marker.id ? ' is-raised' : ''}`}
                style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
              >
                <div
                  className={classes}
                  {...hoverProps(marker.id)}
                  style={{ transform: `translate(-50%, -100%) scale(${1 / zoom})` }}
                  onPointerDown={(e) => startDrag(e, 'marker', marker.id, marker.x, marker.y)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  title={marker.title || (isZoom ? 'Zoom area' : categoryOf(marker.category).label)}
                >
                  <Icon name={isZoom ? 'zoom' : categoryOf(marker.category).icon} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Where you are on the whole map, while zoomed in. Tap to jump. */}
        {zoom > 1.05 && base && box && (
          <button
            type="button"
            className="world-map-viewer__overview"
            style={{ aspectRatio: `${base.w} / ${base.h}` }}
            aria-label="Overview — tap to jump there"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              centreOn((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
            }}
          >
            <img src={map.src} alt="" draggable={false} />
            <span
              className="world-map-viewer__overview-view"
              style={{
                left: `${clamp(-pan.x / (base.w * zoom), 0, 1) * 100}%`,
                top: `${clamp(-pan.y / (base.h * zoom), 0, 1) * 100}%`,
                width: `${Math.min(1, box.w / (base.w * zoom)) * 100}%`,
                height: `${Math.min(1, box.h / (base.h * zoom)) * 100}%`,
              }}
            />
          </button>
        )}

        {showLegend && <MapLegend onClose={() => toggleLegend(false)} />}

        {pings.length === 0 && zoom <= 1.05 && (
          <p className="world-map-viewer__hint">Hold anywhere to ping · double-tap to zoom</p>
        )}
      </div>

      {/* Mini cards for every pin: hover to find it, tap to go there. */}
      {showList && (
        <div className="world-map-viewer__side">
        <aside className="world-map-viewer__list" aria-label="Pins on this map" ref={listRef}>
          {pin.x != null && (
            <button
              type="button"
              data-pin="party"
              className={`world-map-viewer__card world-map-viewer__card--party${hoverId === 'party' ? ' is-hovered' : ''}`}
              {...hoverProps('party')}
              onFocus={() => setHoverId('party')}
              onBlur={() => setHoverId(null)}
              onClick={() => flyTo(pin, 'party')}
            >
              <span className="world-map-viewer__card-icon">
                <Icon name="pin" />
              </span>
              <span className="world-map-viewer__card-text">
                <strong>The party</strong>
                <small>{trail.length ? `Last moved · ${trail[trail.length - 1].label}` : 'Current location'}</small>
              </span>
            </button>
          )}
          {/* The creator / DM drags a card's grip to reorder the list. */}
          <div className="world-map-viewer__sortable" ref={sortRef}>
            {listedMarkers.map((marker, index) => {
              const isZoom = marker.kind === 'zoom'
              const type = isZoom ? { label: 'Area', icon: 'zoom' } : categoryOf(marker.category)
              const entity = linkedEntity(marker)
              return (
                <div
                  key={marker.id}
                  className={`world-map-viewer__card-row${pinDrag.draggingId === marker.id ? ' is-dragging' : ''}`}
                  style={pinDrag.rowStyle(index)}
                >
                  {nav.canArrange && (
                    <button
                      type="button"
                      className="world-map-viewer__grip"
                      aria-label={`Move ${marker.title || type.label} (drag, or use the arrow keys)`}
                      {...pinDrag.handleProps(marker.id, index, sortRef)}
                    >
                      <Icon name="grip" />
                    </button>
                  )}
                  <button
                    type="button"
                    data-pin={marker.id}
                    className={`world-map-viewer__card world-map-viewer__card--${isZoom ? 'zoom' : marker.category}${hoverId === marker.id ? ' is-hovered' : ''}`}
                    {...hoverProps(marker.id)}
                    onFocus={() => setHoverId(marker.id)}
                    onBlur={() => setHoverId(null)}
                    onClick={() => {
                      flyTo(marker, marker.id)
                      if (!isZoom) setDetailsMarker(marker)
                    }}
                  >
                    <span className="world-map-viewer__card-icon">
                      <Icon name={type.icon} />
                    </span>
                    <span className="world-map-viewer__card-text">
                      <strong>{marker.title || type.label}</strong>
                      <small>{[type.label, entity && entity.title].filter(Boolean).join(' · ')}</small>
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
          {orderError && <p className="world-map-viewer__list-empty">{orderError}</p>}
          {markers.length === 0 && pin.x == null && (
            <p className="world-map-viewer__list-empty">No pins yet — drag one from below onto the map.</p>
          )}
        </aside>
        <div className="world-map-viewer__palette" role="group" aria-label="Add to the map">
          <span className="world-map-viewer__palette-label">Drag onto the map</span>
          <div className="world-map-viewer__palette-items">
            <button type="button" className="world-map-viewer__palette-item" {...paletteProps('event')}>
              <Icon name="pushpin" /> Pin
            </button>
            <button
              type="button"
              className="world-map-viewer__palette-item world-map-viewer__palette-item--zoom"
              {...paletteProps('zoom')}
            >
              <Icon name="zoom" /> Zoom area
            </button>
          </div>
        </div>
        </div>
      )}

      {/* The marker being dragged in, under the finger / cursor. */}
      {newDrag?.moved &&
        createPortal(
          <div
            className={`world-map-viewer__ghost${newDrag.over ? ' is-over' : ''}${newDrag.kind === 'zoom' ? ' world-map-viewer__ghost--zoom' : ''}`}
            style={{ left: newDrag.cx, top: newDrag.cy }}
            aria-hidden="true"
          >
            <Icon name={newDrag.kind === 'zoom' ? 'zoom' : 'pushpin'} />
          </div>,
          document.body,
        )}

      {confirmDrop && (
        <div
          className="world-map-viewer__form-backdrop world-map-viewer__form-backdrop--clear"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drop-confirm-title"
          onPointerDown={() => setConfirmDrop(null)}
          onKeyDown={(e) => e.key === 'Escape' && setConfirmDrop(null)}
        >
          <div className="world-map-viewer__form world-map-viewer__confirm panel" onPointerDown={(e) => e.stopPropagation()}>
            <h3 id="drop-confirm-title">{confirmDrop.kind === 'zoom' ? 'Add a zoom area here?' : 'Add a pin here?'}</h3>
            <p>
              {confirmDrop.kind === 'zoom'
                ? 'It opens a closer map of this spot. Next you’ll name it and pick its image.'
                : 'Next you’ll give it a title, a type and any notes.'}
            </p>
            <div className="world-map-viewer__form-actions">
              <button type="button" className="btn btn--text" onClick={() => setConfirmDrop(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={acceptDrop} autoFocus>
                Yes, add it
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {markerForm && (
        <div
          className="world-map-viewer__form-backdrop"
          role="dialog"
          aria-modal="true"
          onPointerDown={cancelMarkerForm}
        >
          <form
            className="world-map-viewer__form panel"
            onPointerDown={(e) => e.stopPropagation()}
            onSubmit={submitMarkerForm}
          >
            <h3>{editingMarkerId ? 'Edit Pin' : 'New Pin'}</h3>
            <div className="field">
              <label htmlFor="marker-title">Title</label>
              <input
                id="marker-title"
                type="text"
                value={markerForm.title}
                onChange={(e) => setMarkerForm({ ...markerForm, title: e.target.value })}
                placeholder="The bridge collapsed"
                required
              />
            </div>
            <div className="world-map-viewer__form-row">
              <div className="field">
                <label htmlFor="marker-category">Type</label>
                <select
                  id="marker-category"
                  value={markerForm.category}
                  onChange={(e) => setMarkerForm({ ...markerForm, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="marker-entity">About</label>
                <select
                  id="marker-entity"
                  value={markerForm.entityKey}
                  onChange={(e) => {
                    const key = e.target.value
                    const entity = linkable.find((x) => `${x.type}:${x.id}` === key)
                    setMarkerForm({
                      ...markerForm,
                      entityKey: key,
                      // An untitled pin takes the entry's name.
                      title: markerForm.title.trim() || !entity ? markerForm.title : entity.title,
                      category:
                        markerForm.category === 'event' && entity?.type === 'quest' ? 'quest' : markerForm.category,
                    })
                  }}
                >
                  <option value="">Nothing linked</option>
                  {LINKABLE.map((group) => {
                    const options = linkable.filter((x) => x.type === group.type)
                    return options.length ? (
                      <optgroup key={group.type} label={group.label}>
                        {options.map((x) => (
                          <option key={x.id} value={`${x.type}:${x.id}`}>
                            {x.title || 'Untitled'}
                          </option>
                        ))}
                      </optgroup>
                    ) : null
                  })}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="marker-notes">Notes</label>
              <textarea
                id="marker-notes"
                value={markerForm.notes}
                onChange={(e) => setMarkerForm({ ...markerForm, notes: e.target.value })}
                placeholder="What happened here..."
              />
            </div>
            <div className="field">
              <label>Photo</label>
              <div className="world-map-viewer__photo-picker">
                <button
                  type="button"
                  className="world-map-viewer__photo-btn"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label="Choose a photo"
                >
                  {markerForm.photoPreview ? (
                    <img src={markerForm.photoPreview} alt="Event" />
                  ) : (
                    <span>+ Photo</span>
                  )}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={photoCrop.fromInput}
                />
                {markerForm.photoPreview && (
                  <button type="button" className="btn btn--text" onClick={() => photoCrop.adjust(markerForm.photoFile, markerForm.photoPreview)}>
                    Edit photo
                  </button>
                )}
                {photoCrop.dialog}
              </div>
            </div>
            {formError && <p className="empty-state empty-state--error">{formError}</p>}
            <div className="world-map-viewer__form-actions">
              <button type="button" className="btn btn--text" onClick={cancelMarkerForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                {editingMarkerId ? 'Save Changes' : 'Add Pin'}
              </button>
            </div>
          </form>
        </div>
      )}

      {zoomForm && (
        <div
          className="world-map-viewer__form-backdrop"
          role="dialog"
          aria-modal="true"
          onPointerDown={cancelZoomForm}
        >
          <form
            className="world-map-viewer__form panel"
            onPointerDown={(e) => e.stopPropagation()}
            onSubmit={submitZoomForm}
          >
            <h3>{zoomForm.editing ? 'Edit Zoom Area' : 'New Zoom Area'}</h3>
            <div className="field">
              <label htmlFor="zoom-title">Title</label>
              <input
                id="zoom-title"
                type="text"
                value={zoomForm.title}
                onChange={(e) => setZoomForm({ ...zoomForm, title: e.target.value })}
                placeholder="Black Forest Region"
                required
              />
            </div>
            <div className="field">
              <label>{zoomForm.editing ? 'Zoomed-in image (tap to replace)' : 'Zoomed-in image'}</label>
              <div className="world-map-viewer__photo-picker">
                <button
                  type="button"
                  className="world-map-viewer__photo-btn"
                  onClick={() => zoomImageInputRef.current?.click()}
                  aria-label="Choose an image"
                >
                  {zoomForm.imagePreview ? (
                    <img src={zoomForm.imagePreview} alt="Zoom area" />
                  ) : (
                    <span>+ Image</span>
                  )}
                </button>
                <input
                  ref={zoomImageInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleZoomImageSelected}
                />
              </div>
            </div>
            {formError && <p className="empty-state empty-state--error">{formError}</p>}
            <div className="world-map-viewer__form-actions">
              <button type="button" className="btn btn--text" onClick={cancelZoomForm}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!zoomForm.title.trim() || (!zoomForm.editing && !zoomForm.imageFile)}
              >
                {zoomForm.editing ? 'Save Changes' : 'Add Zoom Area'}
              </button>
            </div>
          </form>
        </div>
      )}

      {detailsMarker && (
        <div
          className="world-map-viewer__details-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="marker-details-title"
          onPointerDown={() => setDetailsMarker(null)}
        >
          <div className="world-map-viewer__details panel" onPointerDown={(e) => e.stopPropagation()}>
            <div className="world-map-viewer__details-header">
              <h3 id="marker-details-title">{detailsMarker.title || 'Untitled marker'}</h3>
              <button
                type="button"
                className="world-map-viewer__details-close"
                onClick={() => setDetailsMarker(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            {detailsMarker.photo && (
              <img
                className="world-map-viewer__details-photo"
                src={detailsMarker.photo}
                alt={detailsMarker.title || 'Event'}
              />
            )}
            <p className="world-map-viewer__details-type">
              <Icon name={categoryOf(detailsMarker.category).icon} /> {categoryOf(detailsMarker.category).label}
            </p>
            {detailsMarker.notes && (
              <p className="world-map-viewer__details-notes">{detailsMarker.notes}</p>
            )}
            {(() => {
              const entity = linkedEntity(detailsMarker)
              if (!entity) return null
              return (
                <button
                  type="button"
                  className="world-map-viewer__details-link"
                  onClick={() => nav.openEntity(entity.type, entity.id)}
                >
                  <Icon name={entity.icon} />
                  <span>
                    <span className="world-map-viewer__details-link-type">{entity.label}</span>
                    {entity.title || 'Untitled'}
                  </span>
                  <Icon name="next" />
                </button>
              )
            })()}
            <div className="world-map-viewer__details-actions">
              <button type="button" className="btn btn--text" onClick={() => openEditForm(detailsMarker)}>
                Edit
              </button>
              <button type="button" className="btn btn--danger" onClick={() => deleteMarker(detailsMarker)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {openZoomMap && (
        <WorldMapViewer
          map={openZoomMap}
          campaignId={campaignId}
          backLabel={map.caption || 'Interactive Map'}
          onClose={() => setOpenZoomMap(null)}
          onDeleteSelf={() => removeItem(openZoomMap.sourceMarkerId)}
          onRenameSelf={(title) => updateItem(openZoomMap.sourceMarkerId, { title })}
          onUpdated={(patch) => setOpenZoomMap((current) => (current ? { ...current, ...patch } : current))}
        />
      )}
    </div>
  )
}

export default WorldMapViewer
