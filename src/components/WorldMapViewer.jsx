import { useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl, removeImage, uploadImage } from '../lib/storage.js'
import './WorldMapViewer.scss'

const MARKER_BUCKET = 'map-marker-photos'
const ZOOM_MIN = 1
const ZOOM_MAX = 6
const DRAG_THRESHOLD_PX = 5

const emptyMarkerForm = { title: '', notes: '', photoFile: null, photoPreview: '', photoRemoved: false }

const markerFromRow = (r) => ({
  id: r.id,
  x: r.x,
  y: r.y,
  title: r.title,
  notes: r.notes,
  photoPath: r.photo_path,
  photo: getPublicUrl(MARKER_BUCKET, r.photo_path),
})

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// map is the { id, src, caption, pinX, pinY } row from MapsTab. onMovePin
// persists the shared party pin's position back to the maps table (there's
// no separate table for it — see supabase/schema.sql).
function WorldMapViewer({ map, onClose, onMovePin }) {
  const { items: markers, addItem, updateItem, removeItem } =
    useSupabaseTable('map_markers', { fromRow: markerFromRow, filters: { map_id: map.id } })

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [imgSize, setImgSize] = useState(null)
  // The shared pin's position lives in local state, seeded once from the
  // map row and updated only by our own drags/placements — there's no
  // realtime subscription in this app, so nothing else changes it out from
  // under us while this viewer is open (see useSupabaseTable's refetch-on-
  // write behavior: every write already updates the canonical list, this
  // just avoids waiting on that round trip to show the new position).
  const [pin, setPin] = useState({ x: map.pinX, y: map.pinY })
  const [placementMode, setPlacementMode] = useState(null) // null | 'pin' | 'event'
  const [pendingMarkerPos, setPendingMarkerPos] = useState(null)
  const [markerForm, setMarkerForm] = useState(null)
  const [editingMarkerId, setEditingMarkerId] = useState(null)
  const [detailsMarker, setDetailsMarker] = useState(null)
  const [formError, setFormError] = useState(null)
  // { kind: 'pin' | 'marker', id, x, y } while a pin/marker is being
  // dragged — the live position shown on screen during the gesture,
  // separate from the committed `pin` state / `markers` list.
  const [drag, setDrag] = useState(null)

  const viewportRef = useRef(null)
  const stageRef = useRef(null)
  const photoInputRef = useRef(null)
  const objectUrlRef = useRef(null)
  const panStartRef = useRef(null)
  const dragStartRef = useRef(null)
  const activePointersRef = useRef(new Map())
  const pinchRef = useRef(null)

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

  // Zooms so that the world-space point currently under (pointX, pointY)
  // — coordinates relative to the viewport's top-left — stays under that
  // same screen point after the zoom changes. Uses functional state
  // updates throughout so it never closes over stale zoom/pan, which lets
  // the wheel listener below bind once on mount instead of re-binding on
  // every zoom/pan change.
  function zoomAt(pointX, pointY, factor) {
    setZoom((prevZoom) => {
      const newZoom = clamp(prevZoom * factor, ZOOM_MIN, ZOOM_MAX)
      setPan((prevPan) => {
        const stageX = (pointX - prevPan.x) / prevZoom
        const stageY = (pointY - prevPan.y) / prevZoom
        return { x: pointX - stageX * newZoom, y: pointY - stageY * newZoom }
      })
      return newZoom
    })
  }

  function zoomByFactor(factor) {
    const rect = viewportRef.current.getBoundingClientRect()
    zoomAt(rect.width / 2, rect.height / 2, factor)
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
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

    panStartRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      moved: false,
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
      setZoom(newZoom)
      setPan({ x: pointX - stageX * newZoom, y: pointY - stageY * newZoom })
      return
    }

    const start = panStartRef.current
    if (!start) return
    const dx = e.clientX - start.startClientX
    const dy = e.clientY - start.startClientY
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) start.moved = true
    setPan({ x: start.startPanX + dx, y: start.startPanY + dy })
  }

  function handleStagePointerUp(e) {
    activePointersRef.current.delete(e.pointerId)
    if (activePointersRef.current.size < 2) pinchRef.current = null

    const start = panStartRef.current
    panStartRef.current = null
    if (!start || start.moved || !placementMode) return

    const { x, y } = computeFractionalPosition(e.clientX, e.clientY)
    if (placementMode === 'pin') {
      setPin({ x, y })
      setPlacementMode(null)
      Promise.resolve(onMovePin(x, y)).catch((err) => setFormError(err.message))
    } else {
      setPendingMarkerPos({ x, y })
      setPlacementMode(null)
      revokeTrackedObjectUrl()
      setMarkerForm(emptyMarkerForm)
      setEditingMarkerId(null)
      setFormError(null)
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

  async function endDrag(e) {
    const start = dragStartRef.current
    dragStartRef.current = null
    if (!start) return
    e.stopPropagation()

    if (!start.moved) {
      setDrag(null)
      if (start.kind === 'marker') {
        const marker = markers.find((m) => m.id === start.id)
        if (marker) setDetailsMarker(marker)
      }
      return
    }

    const final = { x: drag?.x ?? start.startX, y: drag?.y ?? start.startY }
    if (start.kind === 'pin') {
      // Update local state immediately (no flash), then persist.
      setPin(final)
      setDrag(null)
      try {
        await onMovePin(final.x, final.y)
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

  function handleMarkerPhotoSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

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

    try {
      if (markerForm.photoFile) {
        payload.photo_path = await uploadImage(MARKER_BUCKET, markerForm.photoFile)
      } else if (markerForm.photoRemoved) {
        payload.photo_path = null
      }

      if (editingMarkerId) {
        await updateItem(editingMarkerId, payload)
      } else {
        await addItem({ ...payload, x: pendingMarkerPos.x, y: pendingMarkerPos.y })
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

  const pinPos = drag?.kind === 'pin' ? drag : pin

  return (
    <div className="world-map-viewer" role="dialog" aria-modal="true" aria-label={map.caption || 'World Map'}>
      <div className="world-map-viewer__toolbar">
        <span className="world-map-viewer__title">{map.caption || 'World Map'}</span>
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
          {pin.x == null && (
            <button
              type="button"
              className="btn btn--text"
              onClick={() => setPlacementMode((m) => (m === 'pin' ? null : 'pin'))}
            >
              {placementMode === 'pin' ? 'Click the map to drop your pin' : 'Drop "I am here" pin'}
            </button>
          )}
          <button
            type="button"
            className="btn btn--text"
            onClick={() => setPlacementMode((m) => (m === 'event' ? null : 'event'))}
          >
            {placementMode === 'event' ? 'Click the map to place it' : '+ Drop Event Marker'}
          </button>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div
        className={`world-map-viewer__viewport${placementMode ? ' world-map-viewer__viewport--placing' : ''}`}
        ref={viewportRef}
      >
        <div
          className="world-map-viewer__stage"
          ref={stageRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            aspectRatio: imgSize ? `${imgSize.w} / ${imgSize.h}` : '4 / 3',
          }}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
        >
          <img
            src={map.src}
            alt={map.caption || 'World map'}
            draggable={false}
            onLoad={(e) => setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          />

          {pin.x != null && (
            <div
              className="world-map-viewer__anchor"
              style={{ left: `${pinPos.x * 100}%`, top: `${pinPos.y * 100}%` }}
            >
              <div
                className="world-map-viewer__pin"
                style={{ transform: `translate(-50%, -100%) scale(${1 / zoom})` }}
                onPointerDown={(e) => startDrag(e, 'pin', null, pin.x, pin.y)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                title="Drag to update the party's location"
              >
                📍
              </div>
            </div>
          )}

          {markers.map((marker) => {
            const pos = drag?.kind === 'marker' && drag.id === marker.id ? drag : marker
            return (
              <div
                key={marker.id}
                className="world-map-viewer__anchor"
                style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
              >
                <div
                  className="world-map-viewer__event-marker"
                  style={{ transform: `translate(-50%, -100%) scale(${1 / zoom})` }}
                  onPointerDown={(e) => startDrag(e, 'marker', marker.id, marker.x, marker.y)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  title={marker.title || 'Event marker'}
                >
                  📌
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {markerForm && (
        <div
          className="world-map-viewer__form-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={cancelMarkerForm}
        >
          <form
            className="world-map-viewer__form panel"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitMarkerForm}
          >
            <h3>{editingMarkerId ? 'Edit Event Marker' : 'New Event Marker'}</h3>
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
                  onChange={handleMarkerPhotoSelected}
                />
                {markerForm.photoPreview && (
                  <button type="button" className="btn btn--text" onClick={removeMarkerPhoto}>
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            {formError && <p className="empty-state empty-state--error">{formError}</p>}
            <div className="world-map-viewer__form-actions">
              <button type="button" className="btn btn--text" onClick={cancelMarkerForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                {editingMarkerId ? 'Save Changes' : 'Add Marker'}
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
          onClick={() => setDetailsMarker(null)}
        >
          <div className="world-map-viewer__details panel" onClick={(e) => e.stopPropagation()}>
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
            {detailsMarker.notes && (
              <p className="world-map-viewer__details-notes">{detailsMarker.notes}</p>
            )}
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
    </div>
  )
}

export default WorldMapViewer
