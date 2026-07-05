import { useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { readFileAsDataUrl } from '../utils/files.js'
import './MapsTab.scss'

function MapsTab() {
  const [maps, setMaps] = useLocalStorage('dnd-notes-maps', [])
  const [lightboxMap, setLightboxMap] = useState(null)
  const fileInputRef = useRef(null)

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const newMaps = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(),
        src: await readFileAsDataUrl(file),
        caption: file.name.replace(/\.[^/.]+$/, ''),
      })),
    )

    setMaps((prev) => [...prev, ...newMaps])
    event.target.value = ''
  }

  function updateCaption(id, caption) {
    setMaps((prev) => prev.map((m) => (m.id === id ? { ...m, caption } : m)))
  }

  function removeMap(id) {
    setMaps((prev) => prev.filter((m) => m.id !== id))
    setLightboxMap((current) => (current?.id === id ? null : current))
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

      {maps.length === 0 ? (
        <p className="empty-state">
          No maps yet. Add images your DM has shared to keep track of where
          your party has been.
        </p>
      ) : (
        <div className="maps-tab__grid">
          {maps.map((map) => (
            <figure className="map-card" key={map.id}>
              <button
                type="button"
                className="map-card__image-btn"
                onClick={() => setLightboxMap(map)}
              >
                <img src={map.src} alt={map.caption || 'Campaign map'} />
              </button>
              <input
                className="map-card__caption"
                type="text"
                value={map.caption}
                placeholder="Map name"
                onChange={(e) => updateCaption(map.id, e.target.value)}
              />
              <button
                type="button"
                className="map-card__remove"
                onClick={() => removeMap(map.id)}
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
    </section>
  )
}

export default MapsTab
