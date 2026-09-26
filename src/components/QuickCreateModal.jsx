import { useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { EXTRA_LABELS, QUICK_TYPES, payloadFor } from '../lib/quickTypes.js'
import Modal from './Modal.jsx'
import LinkPicker from './LinkPicker.jsx'

const MAX_NAME = 120

// Creates an NPC / location / quest / clue / lore / loot entry in one
// step, optionally linked to an existing entry. `initial` can pre-fill
// the fields (e.g. when converting a quick note) and `onCreated` receives
// the new entity.
function QuickCreateModal({ initialType = 'npc', initial = {}, onClose, onCreated }) {
  const data = useCampaignData()
  const nav = useCampaignNav()
  const [type, setType] = useState(QUICK_TYPES[initialType] ? initialType : 'npc')
  const [name, setName] = useState(initial.name || '')
  const [kind, setKind] = useState(initial.kind || '')
  const [extra, setExtra] = useState(initial.extra || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const [link, setLink] = useState(initial.link || null)
  const [relation, setRelation] = useState('')
  const [error, setError] = useState(null)
  const [nameError, setNameError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)

  const def = QUICK_TYPES[type]

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError(`${def.nameLabel} is required.`)
      return
    }
    if (trimmed.length > MAX_NAME) {
      setNameError(`Keep it under ${MAX_NAME} characters.`)
      return
    }
    setNameError(null)
    setSaving(true)
    setError(null)
    try {
      const row = await data.tables[def.entity].addItem(
        payloadFor(type, { name: trimmed, kind, notes: notes.trim(), extra: extra.trim() }),
      )
      const entity = { type: def.entity, id: row.id }
      if (link) await data.linkEntities(entity, link, relation.trim())
      await onCreated?.(entity)
      setCreated({ ...entity, title: trimmed })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (created) {
    return (
      <Modal onClose={onClose} label="Entry created">
        <div className="form-stack">
          <h3 className="section-card__title">
            {def.icon} {def.label} added
          </h3>
          <p>
            <strong>{created.title}</strong> is saved
            {link ? ' and linked' : ''}. You can add more detail any time.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--text"
              onClick={() => {
                setCreated(null)
                setName('')
                setNotes('')
                setExtra('')
                setLink(initial.link || null)
              }}
            >
              Add another
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                onClose()
                nav.openEntity(created.type, created.id)
              }}
            >
              View entry
            </button>
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} label={`Add ${def.label}`}>
      <form className="form-stack" onSubmit={submit} noValidate>
        <h3 className="section-card__title">Quick add</h3>

        <div className="chip-row" role="radiogroup" aria-label="Entry type">
          {Object.entries(QUICK_TYPES).map(([id, t]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={type === id}
              className={`chip${type === id ? ' chip--active' : ''}`}
              onClick={() => {
                setType(id)
                setKind('')
              }}
            >
              <span aria-hidden="true">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="quick-create-name">{def.nameLabel}</label>
          <input
            id="quick-create-name"
            type="text"
            value={name}
            maxLength={MAX_NAME + 20}
            onChange={(e) => setName(e.target.value)}
            placeholder={def.placeholder}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'quick-create-name-error' : undefined}
            autoFocus
          />
          {nameError && (
            <p className="field-error" id="quick-create-name-error">
              {nameError}
            </p>
          )}
        </div>

        {(def.kinds || EXTRA_LABELS[type]) && (
          <div className="form-row">
            {def.kinds && (
              <div className="field">
                <label htmlFor="quick-create-kind">Tag</label>
                <select id="quick-create-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {type !== 'place' && <option value="">None</option>}
                  {def.kinds.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {EXTRA_LABELS[type] && (
              <div className="field">
                <label htmlFor="quick-create-extra">{EXTRA_LABELS[type]}</label>
                <input
                  id="quick-create-extra"
                  type="text"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor="quick-create-notes">Notes</label>
          <textarea
            id="quick-create-notes"
            className="field--wide"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </div>

        <LinkPicker
          label="Link to (optional)"
          value={link}
          onChange={setLink}
          relation={relation}
          onRelationChange={setRelation}
        />

        {error && (
          <p className="field-error" role="alert">
            Couldn&apos;t save: {error}
          </p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : `Add ${def.label}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default QuickCreateModal
