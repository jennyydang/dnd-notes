import { useCallback, useMemo, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { useDmShares } from '../hooks/useDmShares.js'
import { getPublicUrl, removeImage, uploadImage } from '../lib/storage.js'
import { removeSharesFor, shareKey, shareWithPlayers } from '../lib/dmShares.js'
import { confirmDelete } from '../lib/confirm.js'
import Modal from './Modal.jsx'
import ArtViewer from './ArtViewer.jsx'
import ShareStatus from './ShareStatus.jsx'
import DmPrivacyNote from './DmPrivacyNote.jsx'
import Icon from './Icon.jsx'
import './ArtGallery.scss'
import { RichTextEditor } from './RichText.jsx'

const BUCKET = 'maps'

const fromRow = (r) => ({
  id: r.id,
  imagePath: r.image_path,
  url: getPublicUrl(BUCKET, r.image_path),
  title: r.caption,
  notes: r.notes,
  createdAt: r.created_at,
})

const partyMapFromRow = (r) => ({ id: r.id, dmMapId: r.dm_map_id })

function captionFromFile(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Untitled map'
}

// The DM's private maps. Share one and players get a notification; adding
// it puts a copy (with its own image file) in the players' Maps tab.
function DmMapsTab({ campaignId }) {
  const { items, loading, error, addItem, updateItem, removeItem } = useSupabaseTable('dm_maps', {
    fromRow,
    filters: { campaign_id: campaignId },
  })
  const { items: partyMaps } = useSupabaseTable('maps', {
    fromRow: partyMapFromRow,
    filters: { campaign_id: campaignId },
  })
  const { byKey, revealedKeys } = useDmShares(campaignId)
  const isRevealed = (map) => revealedKeys.has(shareKey('map', map.id))
  const addedIds = useMemo(() => new Set(partyMaps.map((m) => m.dmMapId).filter(Boolean)), [partyMaps])
  const statusOf = (map) =>
    addedIds.has(map.id) ? 'added' : byKey.has(shareKey('map', map.id)) ? 'sent' : 'private'

  const [viewingId, setViewingId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [upload, setUpload] = useState(null)
  const [uploadErrors, setUploadErrors] = useState([])
  const [actionError, setActionError] = useState(null)
  const [sharingId, setSharingId] = useState(null)
  const fileInputRef = useRef(null)

  const maps = useMemo(() => [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [items])

  async function uploadFiles(event) {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length) return
    setUploadErrors([])
    setUpload({ done: 0, total: files.length })
    const failures = []
    for (const [index, file] of files.entries()) {
      try {
        const path = await uploadImage(BUCKET, file)
        await addItem({ image_path: path, caption: captionFromFile(file.name) })
      } catch (err) {
        failures.push(`${file.name}: ${err.message}`)
      }
      setUpload({ done: index + 1, total: files.length })
    }
    setUpload(null)
    setUploadErrors(failures)
  }

  async function run(action) {
    setActionError(null)
    try {
      await action()
      return true
    } catch (err) {
      setActionError(err.message)
      return false
    }
  }

  async function share(map, reveal = false) {
    setSharingId(map.id)
    const ok = await run(() =>
      shareWithPlayers({
        campaignId,
        kind: 'map',
        sourceId: map.id,
        title: map.title || 'Untitled map',
        payload: { caption: map.title, image_path: map.imagePath },
        reveal,
      }),
    )
    setSharingId(null)
    return ok
  }

  async function remove(map) {
    const status = statusOf(map)
    const message =
      status === 'added'
        ? `Delete your copy of “${map.title || 'this map'}”? The players’ copy in their Maps tab stays. This can't be undone.`
        : null
    if (message ? !window.confirm(message) : !confirmDelete(`the map “${map.title || 'Untitled map'}”`)) return
    await run(async () => {
      await removeItem(map.id)
      await removeSharesFor(map.id)
      // Players' copies have their own image file, so this one is ours.
      removeImage(BUCKET, map.imagePath)
      setViewingId(null)
    })
  }

  async function saveDetails(event) {
    event.preventDefault()
    await run(async () => {
      await updateItem(editing.id, { caption: editing.title.trim(), notes: editing.notes })
      setEditing(null)
    })
  }

  const viewingIndex = maps.findIndex((m) => m.id === viewingId)
  const viewing = viewingIndex >= 0 ? maps[viewingIndex] : null
  const step = useCallback(
    (direction) => {
      if (viewingIndex < 0 || maps.length < 2) return
      setViewingId(maps[(viewingIndex + direction + maps.length) % maps.length].id)
    },
    [viewingIndex, maps],
  )
  const added = maps.filter((m) => statusOf(m) === 'added').length

  return (
    <section className="art-gallery dm-maps">
      <DmPrivacyNote />

      <div className="art-gallery__toolbar">
        <button
          type="button"
          className="btn btn--primary art-gallery__upload"
          onClick={() => fileInputRef.current?.click()}
          disabled={Boolean(upload)}
        >
          {upload ? `Uploading ${Math.min(upload.done + 1, upload.total)} of ${upload.total}…` : '+ Upload maps'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={uploadFiles} />
      </div>

      {maps.length > 0 && (
        <p className="art-gallery__summary">
          {added} of {maps.length} in the players’ Maps tab. Tap a map to view, share or edit it.
        </p>
      )}
      {uploadErrors.length > 0 && (
        <div className="empty-state empty-state--error" role="alert">
          Some files didn’t upload:
          <ul>
            {uploadErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {actionError && (
        <p className="empty-state empty-state--error" role="alert">
          {actionError}
        </p>
      )}
      {loading && <p className="empty-state">Loading…</p>}
      {error && (
        <p className="empty-state empty-state--error">
          {error}
          {/dm_maps/.test(error) && ' — run the latest supabase/schema.sql to add the DM maps table.'}
        </p>
      )}
      {!loading && !error && maps.length === 0 && (
        <p className="empty-state">
          No maps yet. Upload the maps you’ve made (several at once is fine). They stay private until you press Share.
        </p>
      )}

      {!loading && !error && maps.length > 0 && (
        <ul className="art-grid">
          {maps.map((map) => {
            const status = statusOf(map)
            return (
              <li key={map.id} className={`art-tile${isRevealed(map) ? ' dm-revealed' : ''}`}>
                <button type="button" className="art-tile__open" onClick={() => setViewingId(map.id)}>
                  <img src={map.url} alt={map.title || 'Map'} loading="lazy" />
                  <span className="art-tile__caption">
                    <span className="art-tile__title">{map.title || 'Untitled map'}</span>
                    <span className="art-tile__category">Map</span>
                  </span>
                </button>
                <span className={`art-tile__share art-tile__share--${status}`}>
                  <Icon name={{ added: 'eye', sent: 'send', private: 'lock' }[status]} /> {{ added: 'Players have it', sent: 'Sent', private: 'Private' }[status]}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {viewing && (
        <ArtViewer
          piece={{ ...viewing, category: 'Map' }}
          position={`${viewingIndex + 1} / ${maps.length}`}
          onStep={maps.length > 1 ? step : null}
          onClose={() => setViewingId(null)}
          actions={
            <>
              <ShareStatus
                kind="map"
                status={statusOf(viewing)}
                sharing={sharingId === viewing.id}
                onShare={() => share(viewing)}
                onReveal={() => share(viewing, true)}
                revealed={isRevealed(viewing)}
              />
              <button
                type="button"
                className="btn btn--text"
                onClick={() => setEditing({ id: viewing.id, title: viewing.title, notes: viewing.notes })}
              >
                Edit details
              </button>
              <button type="button" className="btn btn--danger" onClick={() => remove(viewing)}>
                Delete
              </button>
            </>
          }
        />
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)} label="Edit map details">
          <form className="art-form form-stack" onSubmit={saveDetails}>
            <h3 className="section-card__title">Map details</h3>
            <div className="field">
              <label htmlFor="dm-map-caption">Caption (players see this)</label>
              <input
                id="dm-map-caption"
                type="text"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="dm-map-notes"><Icon name="lock" /> DM notes (never shared)</label>
              <RichTextEditor
                id="dm-map-notes"
                value={editing.notes}
                onChange={(html) => setEditing((prev) => ({ ...prev, notes: html }))}
                ariaLabel="notes"
                placeholder="Traps, secret doors, what's really in the cellar…"
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn--text" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

export default DmMapsTab
