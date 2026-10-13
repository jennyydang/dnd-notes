import { useCallback, useMemo, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl, removeImage, uploadImage } from '../lib/storage.js'
import { confirmDelete } from '../lib/confirm.js'
import Modal from './Modal.jsx'
import TabNav from './TabNav.jsx'
import DmPrivacyNote from './DmPrivacyNote.jsx'
import ArtViewer from './ArtViewer.jsx'
import ShareStatus from './ShareStatus.jsx'
import { useDmShares } from '../hooks/useDmShares.js'
import { removeSharesFor, shareKey, shareWithPlayers } from '../lib/dmShares.js'
import './ArtGallery.scss'

const BUCKET = 'campaign-art'
const ART_CATEGORIES = ['NPC', 'Location', 'Map', 'Creature', 'Item', 'Scene', 'Handout', 'Other']

const fromRow = (r) => ({
  id: r.id,
  imagePath: r.image_path,
  url: getPublicUrl(BUCKET, r.image_path),
  title: r.title,
  category: r.category,
  notes: r.notes,
  shared: r.shared,
  createdAt: r.created_at,
})

// "goblin_camp-final.png" → "Goblin camp final"
function titleFromFile(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Untitled'
}

// Every piece of art used in the campaign. The DM view (`manage`) uploads
// and labels it privately, then Shares a piece: players get a notification
// and one of them adds it to the players' Art tab (which shows only those).
// Both open pieces in a full-screen viewer, handy for showing at the table.
function ArtGallery({ campaignId, manage = false }) {
  const { items, loading, error, addItem, updateItem, removeItem } = useSupabaseTable('campaign_art', {
    fromRow,
    filters: { campaign_id: campaignId },
  })
  const [category, setCategory] = useState('all')
  const [viewingId, setViewingId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [upload, setUpload] = useState(null) // { done, total }
  const [uploadErrors, setUploadErrors] = useState([])
  const [actionError, setActionError] = useState(null)
  const fileInputRef = useRef(null)

  const pieces = useMemo(
    () =>
      items
        .filter((a) => manage || a.shared)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [items, manage],
  )
  const usedCategories = ART_CATEGORIES.filter((c) => pieces.some((a) => a.category === c))
  const visible = pieces.filter((a) => category === 'all' || a.category === category)
  const sharedCount = pieces.filter((a) => a.shared).length
  const { byKey } = useDmShares(campaignId)
  const [sharingId, setSharingId] = useState(null)
  // 'added' (in the players' Art tab), 'sent' (notification out), 'private'.
  const statusOf = (piece) =>
    piece.shared ? 'added' : byKey.has(shareKey('art', piece.id)) ? 'sent' : 'private'

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
        await addItem({
          image_path: path,
          title: titleFromFile(file.name),
          category: category === 'all' ? 'Other' : category,
          shared: false,
        })
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
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function share(piece) {
    setSharingId(piece.id)
    await run(() =>
      shareWithPlayers({
        campaignId,
        kind: 'art',
        sourceId: piece.id,
        title: piece.title || 'Untitled',
        payload: { title: piece.title, category: piece.category, notes: piece.notes, image_path: piece.imagePath },
      }),
    )
    setSharingId(null)
  }

  // Takes it back out of the players' Art tab; Share again to re-send.
  function unshare(piece) {
    if (!window.confirm(`Remove “${piece.title || 'this art'}” from the players’ Art tab?`)) return
    run(async () => {
      await updateItem(piece.id, { shared: false })
      await removeSharesFor(piece.id)
    })
  }

  async function remove(piece) {
    if (!confirmDelete(`“${piece.title || 'this art'}”`)) return
    await run(async () => {
      await removeItem(piece.id)
      await removeSharesFor(piece.id)
      removeImage(BUCKET, piece.imagePath)
      setViewingId(null)
    })
  }

  async function saveDetails(event) {
    event.preventDefault()
    await run(async () => {
      await updateItem(editing.id, {
        title: editing.title.trim(),
        category: editing.category,
        notes: editing.notes,
      })
      setEditing(null)
    })
  }

  const viewingIndex = visible.findIndex((a) => a.id === viewingId)
  const viewing = viewingIndex >= 0 ? visible[viewingIndex] : null
  const step = useCallback(
    (direction) => {
      if (viewingIndex < 0 || visible.length < 2) return
      setViewingId(visible[(viewingIndex + direction + visible.length) % visible.length].id)
    },
    [viewingIndex, visible],
  )

  return (
    <section className="art-gallery">
      {manage && <DmPrivacyNote />}

      <div className="art-gallery__toolbar">
        {pieces.length > 0 && (
          <TabNav
            tabs={[
              { id: 'all', label: `All (${pieces.length})` },
              ...usedCategories.map((c) => ({ id: c, label: c })),
            ]}
            activeTab={usedCategories.includes(category) ? category : 'all'}
            onSelect={setCategory}
            className="tab-nav--pill art-gallery__filter"
            label="Filter art by category"
          />
        )}
        {manage && (
          <>
            <button
              type="button"
              className="btn btn--primary art-gallery__upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={Boolean(upload)}
            >
              {upload ? `Uploading ${Math.min(upload.done + 1, upload.total)} of ${upload.total}…` : '+ Upload art'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={uploadFiles} />
          </>
        )}
      </div>

      {manage && pieces.length > 0 && (
        <p className="art-gallery__summary">
          {sharedCount} of {pieces.length} in the players’ Art tab. Tap a piece to view, share or edit it.
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
          {/campaign_art/.test(error) && ' — run the latest supabase/schema.sql to add the art gallery table.'}
        </p>
      )}
      {!loading && !error && pieces.length === 0 && (
        <p className="empty-state">
          {manage
            ? 'No art yet. Upload the portraits, maps and scenes you’ve used — you can pick several at once, and choose which ones players can see.'
            : 'No art shared yet. When your DM shares portraits, maps or scenes, they’ll show up here.'}
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <ul className="art-grid">
          {visible.map((piece) => (
            <li key={piece.id} className="art-tile">
              <button type="button" className="art-tile__open" onClick={() => setViewingId(piece.id)}>
                <img src={piece.url} alt={piece.title || 'Campaign art'} loading="lazy" />
                <span className="art-tile__caption">
                  <span className="art-tile__title">{piece.title || 'Untitled'}</span>
                  <span className="art-tile__category">{piece.category}</span>
                </span>
              </button>
              {manage && (
                <span className={`art-tile__share art-tile__share--${statusOf(piece)}`}>
                  {{ added: '👁 Players have it', sent: '📨 Sent', private: '🔒 Private' }[statusOf(piece)]}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <ArtViewer
          piece={viewing}
          position={`${viewingIndex + 1} / ${visible.length}`}
          onStep={visible.length > 1 ? step : null}
          onClose={() => setViewingId(null)}
          actions={
            manage && (
              <>
                <ShareStatus
                  kind="art"
                  status={statusOf(viewing)}
                  sharing={sharingId === viewing.id}
                  onShare={() => share(viewing)}
                />
                {viewing.shared && (
                  <button type="button" className="btn btn--text" onClick={() => unshare(viewing)}>
                    Remove from players
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => setEditing({ id: viewing.id, title: viewing.title, category: viewing.category, notes: viewing.notes })}
                >
                  Edit details
                </button>
                <button type="button" className="btn btn--danger" onClick={() => remove(viewing)}>
                  Delete
                </button>
              </>
            )
          }
        />
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)} label="Edit art details">
          <form className="art-form form-stack" onSubmit={saveDetails}>
            <h3 className="section-card__title">Art details</h3>
            <div className="field">
              <label htmlFor="art-title">Title</label>
              <input
                id="art-title"
                type="text"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="art-category">Category</label>
              <select
                id="art-category"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              >
                {ART_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="art-notes">Notes</label>
              <textarea
                id="art-notes"
                rows={3}
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                placeholder="Which session, who it shows, where it came from…"
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

export default ArtGallery
