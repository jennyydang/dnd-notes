import { useMemo, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import TabNav from './TabNav.jsx'
import './LootTab.scss'

const ALL_HOLDERS = 'all'
const UNCLAIMED = '__unclaimed__'

const SORT_MODES = [
  { id: 'recent', label: 'Last Added' },
  { id: 'alpha', label: 'A → Z' },
]

const emptyForm = { item: '', foundAt: '', holder: '', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  item: r.item,
  foundAt: r.found_at,
  holder: r.holder,
  notes: r.notes,
  createdAt: r.created_at,
})

const partyFromRow = (r) => ({ id: r.id, name: r.name })

function LootTab({ campaignId }) {
  const { items: loot, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('loot', { fromRow, filters: { campaign_id: campaignId } })
  // Pulled in just so a party member shows up as a holder tab the moment
  // they join, rather than only after loot gets logged under their name.
  const { items: party } = useSupabaseTable('party_members', {
    fromRow: partyFromRow,
    filters: { campaign_id: campaignId },
  })
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [holderView, setHolderView] = useState(ALL_HOLDERS)
  const [sortMode, setSortMode] = useState('recent')

  // Sorted client-side rather than via the hook's server-side orderBy so
  // the toggle can flip instantly without a refetch. "Last Added" reads
  // newest-first off created_at; useSupabaseTable's default fetch order
  // doesn't matter here since both branches re-sort the full list anyway.
  const sortedLoot = useMemo(() => {
    const list = [...loot]
    if (sortMode === 'alpha') {
      list.sort((a, b) => a.item.trim().localeCompare(b.item.trim()))
    } else {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    return list
  }, [loot, sortMode])

  const holders = [...new Set([
    ...loot.map((entry) => entry.holder.trim()),
    ...party.map((member) => member.name.trim()),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const hasUnclaimed = loot.some((entry) => !entry.holder.trim())

  const holderTabs = [
    { id: ALL_HOLDERS, label: 'All' },
    ...holders.map((holder) => ({ id: holder, label: holder })),
    ...(hasUnclaimed ? [{ id: UNCLAIMED, label: 'Unclaimed' }] : []),
  ]

  // A holder tab can disappear (its last item got deleted, edited to a new
  // holder, or the holder text changed) out from under whatever's
  // selected — derive the effective view each render instead of syncing
  // state, so it falls back to "All" rather than silently filtering to
  // nothing with no tab shown as active.
  const effectiveHolderView = holderTabs.some((tab) => tab.id === holderView)
    ? holderView
    : ALL_HOLDERS

  const visibleLoot = sortedLoot.filter((entry) => {
    // Never let the holder filter hide the card someone's actively
    // editing out from under them — only relevant if they switch tabs
    // mid-edit, but otherwise the open form would just vanish.
    if (entry.id === editingId) return true
    if (effectiveHolderView === ALL_HOLDERS) return true
    if (effectiveHolderView === UNCLAIMED) return !entry.holder.trim()
    return entry.holder.trim() === effectiveHolderView
  })

  function startAdding() {
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setIsAdding(true)
  }

  function startEditing(entry) {
    setForm({
      item: entry.item,
      foundAt: entry.foundAt,
      holder: entry.holder,
      notes: entry.notes,
    })
    setIsAdding(false)
    setFormError(null)
    setEditingId(entry.id)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!form.item.trim()) return

    const payload = {
      item: form.item,
      found_at: form.foundAt,
      holder: form.holder,
      notes: form.notes,
    }

    try {
      if (editingId) {
        await updateItem(editingId, payload)
      } else {
        await addItem(payload)
      }
      cancelForm()
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function removeLoot(id) {
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  function renderLootForm(standalone) {
    return (
    <form className={`loot-form panel${standalone ? ' loot-form--standalone' : ''}`} onSubmit={submitForm}>
          <div className="loot-form__grid">
            <div className="field">
              <label htmlFor="loot-item">Item</label>
              <input
                id="loot-item"
                type="text"
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
                placeholder="Ring of Feather Falling"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="loot-found">Where we got it</label>
              <input
                id="loot-found"
                type="text"
                value={form.foundAt}
                onChange={(e) => setForm({ ...form, foundAt: e.target.value })}
                placeholder="Chest in the Sunken Crypt"
              />
            </div>
            <div className="field">
              <label htmlFor="loot-holder">Who has it</label>
              <input
                id="loot-holder"
                type="text"
                value={form.holder}
                onChange={(e) => setForm({ ...form, holder: e.target.value })}
                placeholder="Party stash / Thessaly"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="loot-notes">Notes</label>
            <textarea
              id="loot-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Unidentified, seems to hum faintly near water..."
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="loot-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Loot'}
            </button>
          </div>
        </form>
    )
  }

  return (
    <section className="loot-tab">
      <div className="loot-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Loot
        </button>
      </div>

      {isAdding && renderLootForm(true)}

      {!loading && !error && loot.length > 1 && (
        <TabNav
          tabs={SORT_MODES}
          activeTab={sortMode}
          onSelect={setSortMode}
          className="tab-nav--pill"
          label="Sort loot"
        />
      )}

      {!loading && !error && holderTabs.length > 1 && (
        <TabNav
          tabs={holderTabs}
          activeTab={effectiveHolderView}
          onSelect={setHolderView}
          className="tab-nav--pill"
          label="Filter loot by holder"
        />
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && loot.length === 0 && (
        <p className="empty-state">
          No loot logged yet. Track the treasures your party has claimed.
        </p>
      )}

      {!loading && !error && loot.length > 0 && visibleLoot.length === 0 && (
        <p className="empty-state">Nobody here — try a different holder.</p>
      )}

      {!loading && !error && visibleLoot.length > 0 && (
        <div className="loot-list">
          {visibleLoot.map((entry) =>
            editingId === entry.id ? (
              <div className="loot-list__edit-slot" key={entry.id}>
                {renderLootForm(false)}
              </div>
            ) : (
              <article className="loot-card panel" key={entry.id}>
                <div className="loot-card__main">
                  <h3 className="loot-card__item">{entry.item}</h3>
                  {entry.foundAt && (
                    <span className="loot-card__found-at">{entry.foundAt}</span>
                  )}
                </div>
                {entry.holder && (
                  <p className="loot-card__holder">
                    <span>Held by</span> {entry.holder}
                  </p>
                )}
                {entry.notes && <p className="loot-card__notes">{entry.notes}</p>}
                <div className="loot-card__actions">
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => startEditing(entry)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => removeLoot(entry.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  )
}

export default LootTab
