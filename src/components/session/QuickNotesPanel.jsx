import { useState } from 'react'
import { useCampaignData, useCampaignNav } from '../../hooks/useCampaignData.js'
import { formatTime } from '../../lib/sessionMode.js'
import { QUICK_TYPES } from '../../lib/quickTypes.js'
import QuickNoteInput from '../QuickNoteInput.jsx'
import QuickCreateModal from '../QuickCreateModal.jsx'
import { SectionCard, StatusMessage } from '../ui.jsx'

function splitNote(content) {
  const [first, ...rest] = content.trim().split('\n')
  return { name: first.slice(0, 120), notes: rest.join('\n').trim() || (first.length > 120 ? content : '') }
}

function NoteRow({ note, onEdit, onDelete, onConvert, convertedEntity, onOpenConverted }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.content)
  const [error, setError] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  async function save(event) {
    event.preventDefault()
    if (!draft.trim()) {
      setError('A note can’t be empty — delete it instead.')
      return
    }
    try {
      await onEdit(note.id, draft)
      setEditing(false)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <li className="quick-notes__item">
      <time className="quick-notes__time" dateTime={note.createdAt}>
        {formatTime(note.createdAt)}
      </time>
      {editing ? (
        <form className="quick-notes__edit" onSubmit={save}>
          <label className="sr-only" htmlFor={`edit-note-${note.id}`}>
            Edit note
          </label>
          <textarea
            id={`edit-note-${note.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
          />
          {error && <p className="field-error">{error}</p>}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--text"
              onClick={() => {
                setEditing(false)
                setDraft(note.content)
                setError(null)
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn">
              Save
            </button>
          </div>
        </form>
      ) : (
        <div className="quick-notes__body">
          <p className="quick-notes__content">{note.content}</p>
          {note.convertedTo && (
            <p className="quick-notes__converted">
              ✓ Turned into{' '}
              {convertedEntity ? (
                <button type="button" className="btn btn--text" onClick={onOpenConverted}>
                  {convertedEntity.label}: {convertedEntity.title}
                </button>
              ) : (
                'an entry (since deleted)'
              )}
            </p>
          )}
          {note.sessionNoteId && <p className="quick-notes__converted">✓ In a session recap</p>}
        </div>
      )}
      {!editing && (
        <div className="quick-notes__actions">
          <div className="quick-notes__convert">
            <button
              type="button"
              className="btn btn--text"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              Make entry ▾
            </button>
            {menuOpen && (
              <ul className="quick-notes__menu panel">
                {Object.entries(QUICK_TYPES).map(([type, def]) => (
                  <li key={type}>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onConvert(type)
                      }}
                    >
                      <span aria-hidden="true">{def.icon}</span> {def.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit note">
            ✎
          </button>
          <button type="button" className="icon-btn" onClick={() => onDelete(note)} aria-label="Delete note">
            🗑
          </button>
        </div>
      )}
    </li>
  )
}

// Timestamped notes for the live game. Any note can become a structured
// NPC / location / quest / clue / lore / loot entry in two taps — its text
// pre-fills the form, nothing is retyped.
function QuickNotesPanel({ quickNotes, since }) {
  const { getEntity } = useCampaignData()
  const nav = useCampaignNav()
  const [converting, setConverting] = useState(null)
  const [showAll, setShowAll] = useState(false)

  if (!quickNotes.enabled) {
    return (
      <SectionCard title="Quick notes" icon="✏️">
        <p className="inline-state">Quick notes are personal — log in as a player to use them.</p>
      </SectionCard>
    )
  }

  const visible = showAll || !since ? quickNotes.notes : quickNotes.notes.filter((n) => new Date(n.createdAt) >= new Date(since))
  const hiddenCount = quickNotes.notes.length - visible.length

  return (
    <SectionCard title="Quick notes" icon="✏️" className="quick-notes">
      <QuickNoteInput onAdd={quickNotes.add} placeholder="What just happened? (Enter to save)" />

      {quickNotes.pendingDelete && (
        <p className="field-hint" role="status">
          Note deleted.{' '}
          <button type="button" className="btn btn--text" onClick={quickNotes.undoRemove}>
            Undo
          </button>
        </p>
      )}

      <StatusMessage loading={quickNotes.loading && !quickNotes.notes.length} error={quickNotes.error} empty={!visible.length}>
        {since ? 'No notes this session yet.' : 'No quick notes yet.'}
      </StatusMessage>

      {visible.length > 0 && (
        <ol className="quick-notes__list">
          {visible.map((note) => {
            const [type, id] = (note.convertedTo || '').split(':')
            const convertedEntity = type && id ? getEntity(type, id) : null
            return (
              <NoteRow
                key={note.id}
                note={note}
                onEdit={quickNotes.edit}
                onDelete={quickNotes.remove}
                onConvert={(t) => setConverting({ type: t, note })}
                convertedEntity={convertedEntity}
                onOpenConverted={() => convertedEntity && nav.openEntity(convertedEntity.type, convertedEntity.id)}
              />
            )
          })}
        </ol>
      )}
      {since && hiddenCount > 0 && (
        <button type="button" className="btn btn--text" onClick={() => setShowAll(true)}>
          Show {hiddenCount} earlier note{hiddenCount === 1 ? '' : 's'}
        </button>
      )}

      {converting && (
        <QuickCreateModal
          initialType={converting.type}
          initial={splitNote(converting.note.content)}
          onClose={() => setConverting(null)}
          onCreated={(entity) => quickNotes.markConverted(converting.note.id, entity)}
        />
      )}
    </SectionCard>
  )
}

export default QuickNotesPanel
