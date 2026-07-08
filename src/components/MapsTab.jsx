import { useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl, removeImage, uploadImage } from '../lib/storage.js'
import WorldMapViewer from './WorldMapViewer.jsx'
import './MapsTab.scss'

const BUCKET = 'maps'

const fromRow = (r) => ({
  id: r.id,
  imagePath: r.image_path,
  caption: r.caption,
  src: getPublicUrl(BUCKET, r.image_path),
  isWorldMap: r.is_world_map,
  pinX: r.pin_x,
  pinY: r.pin_y,
  sourceMarkerId: r.source_marker_id,
})

function MapsTab({ campaignId }) {
  const { items: maps, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('maps', { fromRow, filters: { campaign_id: campaignId } })
  const [lightboxMap, setLightboxMap] = useState(null)
  const [activeWorldMapId, setActiveWorldMapId] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [captionDrafts, setCaptionDrafts] = useState({})
  const fileInputRef = useRef(null)
  const activeWorldMap = maps.find((m) => m.id === activeWorldMapId) || null
  // Zoom-area maps (nested under a 'zoom' marker on another map) aren't
  // top-level campaign maps — they're only reachable by clicking that
  // marker, not from this flat grid.
  const topLevelMaps = maps.filter((m) => !m.sourceMarkerId)

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    event.target.value = ''
    setUploadError(null)

    try {
      for (const file of files) {
        const imagePath = await uploadImage(BUCKET, file)
        await addItem({
          image_path: imagePath,
          caption: file.name.replace(/\.[^/.]+$/, ''),
        })
      }
    } catch (err) {
      setUploadError(err.message)
    }
  }

  function draftCaption(id, caption) {
    setCaptionDrafts((prev) => ({ ...prev, [id]: caption }))
  }

  async function commitCaption(map) {
    const draft = captionDrafts[map.id]
    if (draft === undefined || draft === map.caption) return
    await updateItem(map.id, { caption: draft })
    setCaptionDrafts((prev) => {
      const next = { ...prev }
      delete next[map.id]
      return next
    })
  }

  async function removeMap(map) {
    await removeItem(map.id)
    await removeImage(BUCKET, map.imagePath)
    setLightboxMap((current) => (current?.id === map.id ? null : current))
    setActiveWorldMapId((current) => (current === map.id ? null : current))
  }

  function openMap(map) {
    if (map.isWorldMap) {
      setActiveWorldMapId(map.id)
    } else {
      setLightboxMap(map)
    }
  }

  // Only one map per campaign may be the interactive World Map — clear
  // the old flag before setting the new one, since the DB's partial
  // unique index rejects two true rows at once.
  async function setWorldMap(map) {
    const current = maps.find((m) => m.isWorldMap && m.id !== map.id)
    if (current) await updateItem(current.id, { is_world_map: false })
    await updateItem(map.id, { is_world_map: true })
  }

  async function unsetWorldMap(map) {
    await updateItem(map.id, { is_world_map: false })
    setActiveWorldMapId((current) => (current === map.id ? null : current))
  }

  return (
    <section className="maps-tab">
      <div className="maps-tab__toolbar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => fileInputRef.current?.click()}
        >
          + Add Map Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFilesSelected}
        />
      </div>

      {uploadError && <p className="empty-state empty-state--error">{uploadError}</p>}
      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && topLevelMaps.length === 0 && (
        <p className="empty-state">
          No maps yet. Add images your DM has shared to keep track of where
          your party has been.
        </p>
      )}

      {!loading && !error && topLevelMaps.length > 0 && (
        <div className="maps-tab__grid">
          {topLevelMaps.map((map) => (
            <figure className="map-card" key={map.id}>
              <button
                type="button"
                className="map-card__image-btn"
                onClick={() => openMap(map)}
              >
                <img src={map.src} alt={map.caption || 'Campaign map'} />
              </button>
              {map.isWorldMap && <span className="map-card__world-badge">World Map</span>}
              <input
                className="map-card__caption"
                type="text"
                value={captionDrafts[map.id] ?? map.caption}
                placeholder="Map name"
                onChange={(e) => draftCaption(map.id, e.target.value)}
                onBlur={() => commitCaption(map)}
              />
              <button
                type="button"
                className="map-card__world-toggle btn btn--text"
                onClick={() => (map.isWorldMap ? unsetWorldMap(map) : setWorldMap(map))}
              >
                {map.isWorldMap ? 'Unset World Map' : 'Set as World Map'}
              </button>
              <button
                type="button"
                className="map-card__remove"
                onClick={() => removeMap(map)}
                aria-label={`Remove ${map.caption || 'map'}`}
              >
                &times;
              </button>
            </figure>
          ))}
        </div>
      )}

      {lightboxMap && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxMap(null)}
        >
          <img src={lightboxMap.src} alt={lightboxMap.caption} />
          <p className="lightbox__caption">{lightboxMap.caption}</p>
          <button
            type="button"
            className="lightbox__close"
            onClick={() => setLightboxMap(null)}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
      )}

      {activeWorldMap && (
        <WorldMapViewer
          map={activeWorldMap}
          campaignId={campaignId}
          onClose={() => setActiveWorldMapId(null)}
        />
      )}
    </section>
  )
}

export default MapsTab
