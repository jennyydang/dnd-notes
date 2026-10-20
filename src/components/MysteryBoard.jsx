import { useState } from 'react'
import { useCampaignData } from '../hooks/useCampaignData.js'
import { useActiveSession } from '../hooks/useActiveSession.js'
import { getPlayerSession } from '../lib/auth.js'
import { confirmDelete } from '../lib/confirm.js'
import {
  CLUE_STATUSES,
  clueStatus,
  foundLabel,
  groupClues,
  isClue,
  quietSince,
  rankTheories,
  sessionLabel,
} from '../lib/mysteries.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import { RichText, RichTextEditor } from './RichText.jsx'
import './MysteryBoard.scss'

// The Mysteries side of Lore & Clues: open questions with the clues and
// theories that bear on them, a tray of loose clues waiting to be filed,
// and the solved ones, whose answers live on in Lore.
function MysteryBoard({ campaignId, lore, mysteries, theories, votes, openId, setOpenId, onShowLore }) {
  const data = useCampaignData()
  const { playerId } = data
  const [active] = useActiveSession(campaignId, playerId)
  const currentSession = sessionLabel(data.tables.session.items.length, active)
  const [dialog, setDialog] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [dropId, setDropId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const clues = lore.items.filter(isClue)
  const cluesFor = (mysteryId) => clues.filter((c) => c.mysteryId === mysteryId)
  const theoriesFor = (mysteryId) =>
    rankTheories(
      theories.items.filter((t) => t.mysteryId === mysteryId),
      votes.items,
      playerId,
    )
  const known = new Set(mysteries.items.map((m) => m.id))
  const loose = clues.filter((c) => !c.mysteryId || !known.has(c.mysteryId))
  const open = mysteries.items.filter((m) => !m.solvedAt)
  const solved = mysteries.items.filter((m) => m.solvedAt).sort((a, b) => String(b.solvedAt).localeCompare(String(a.solvedAt)))
  const openMystery = mysteries.items.find((m) => m.id === openId) || null

  async function run(action) {
    setActionError(null)
    try {
      await action()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const fileClue = (clueId, mysteryId) => run(() => lore.updateItem(clueId, { mystery_id: mysteryId || null }))
  const setStatus = (clueId, status) => run(() => lore.updateItem(clueId, { clue_status: status }))

  async function toggleVote(theory) {
    if (!playerId) return
    const mine = votes.items.find((v) => v.theoryId === theory.id && v.playerId === playerId)
    await run(() => (mine ? votes.removeItem(mine.id) : votes.addItem({ theory_id: theory.id, player_id: playerId })))
  }

  async function removeMystery(mystery) {
    if (!confirmDelete(`“${mystery.question}” (its clues go back to the loose tray)`)) return
    await run(() => mysteries.removeItem(mystery.id))
    setOpenId(null)
  }

  async function removeClue(clue) {
    if (!confirmDelete(`the clue “${clue.title}”`)) return
    await run(() => lore.removeItem(clue.id))
    setDialog(null)
  }

  const dropProps = (mysteryId) => ({
    onDragOver: (e) => {
      if (!dragId) return
      e.preventDefault()
      setDropId(mysteryId)
    },
    onDragLeave: () => setDropId((id) => (id === mysteryId ? null : id)),
    onDrop: (e) => {
      e.preventDefault()
      const id = e.dataTransfer.getData('text/plain') || dragId
      setDragId(null)
      setDropId(null)
      if (id) fileClue(id, mysteryId)
    },
  })

  if (mysteries.error) {
    return (
      <div className="setup-notice panel">
        <h2>One step to set up</h2>
        <p>
          Mysteries need a small database update. Run the newest “Mysteries, clues and theories” block of{' '}
          <code>supabase/schema.sql</code> in Supabase, then reload.
        </p>
        <p className="empty-state empty-state--error">{mysteries.error}</p>
      </div>
    )
  }

  const dialogs = (
    <>
      {dialog?.kind === 'mystery' && (
        <MysteryForm
          mystery={dialog.mystery}
          onClose={() => setDialog(null)}
          onSave={async (question) => {
            if (dialog.mystery) await mysteries.updateItem(dialog.mystery.id, { question })
            else {
              const row = await mysteries.addItem({ question, created_by: playerId || null })
              if (dialog.fileClue) await lore.updateItem(dialog.fileClue, { mystery_id: row.id })
            }
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'clue' && (
        <ClueForm
          clue={dialog.clue}
          mysteryId={dialog.mysteryId}
          mysteries={open}
          currentSession={currentSession}
          onClose={() => setDialog(null)}
          onDelete={dialog.clue ? () => removeClue(dialog.clue) : null}
          onSave={async (fields) => {
            if (dialog.clue) await lore.updateItem(dialog.clue.id, fields)
            else await lore.addItem({ ...fields, category: 'Clue' })
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'theory' && (
        <TheoryForm
          theory={dialog.theory}
          clues={cluesFor(dialog.mysteryId)}
          onClose={() => setDialog(null)}
          onDelete={
            dialog.theory
              ? async () => {
                  if (!confirmDelete(`the theory “${dialog.theory.text}”`)) return
                  await theories.removeItem(dialog.theory.id)
                  setDialog(null)
                }
              : null
          }
          onSave={async (fields) => {
            if (dialog.theory) await theories.updateItem(dialog.theory.id, fields)
            else
              await theories.addItem({
                ...fields,
                mystery_id: dialog.mysteryId,
                created_by: playerId || null,
                author_name: getPlayerSession()?.username || 'DM',
                found_in: currentSession,
              })
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'solve' && (
        <SolveForm
          mystery={dialog.mystery}
          currentSession={currentSession}
          onClose={() => setDialog(null)}
          onSave={async ({ answer, solvedIn }) => {
            const m = dialog.mystery
            // The answer becomes (or updates) a Lore entry of its own.
            const entry = { title: m.question, notes: answer }
            let loreId = m.loreId && lore.items.some((x) => x.id === m.loreId) ? m.loreId : null
            if (loreId) await lore.updateItem(loreId, entry)
            else loreId = (await lore.addItem({ ...entry, category: 'Solved mystery' })).id
            await mysteries.updateItem(m.id, {
              answer,
              solved_in: solvedIn,
              solved_at: m.solvedAt || new Date().toISOString(),
              lore_id: loreId,
            })
            setDialog(null)
          }}
        />
      )}
    </>
  )

  if (openMystery) {
    const mClues = cluesFor(openMystery.id)
    const ranked = theoriesFor(openMystery.id)
    const byId = new Map(mClues.map((c) => [c.id, c]))
    return (
      <section className="mystery-detail" aria-label="Mystery">
        <button type="button" className="btn btn--text mystery-detail__back" onClick={() => setOpenId(null)}>
          <Icon name="prev" /> All mysteries
        </button>
        <header className="mystery-detail__head">
          <div>
            <p className="mystery__eyebrow">
              {openMystery.solvedAt ? `Solved${openMystery.solvedIn ? ` in ${openMystery.solvedIn}` : ''}` : 'Open mystery'}
            </p>
            <h2 className="mystery-detail__title">{openMystery.question}</h2>
          </div>
          <div className="mystery-detail__actions">
            <button type="button" className="btn btn--text" onClick={() => setDialog({ kind: 'mystery', mystery: openMystery })}>
              <Icon name="edit" /> Rename
            </button>
            <button type="button" className="btn btn--danger" onClick={() => removeMystery(openMystery)}>
              <Icon name="trash" /> Delete
            </button>
            <button type="button" className="btn" onClick={() => setDialog({ kind: 'clue', mysteryId: openMystery.id })}>
              <Icon name="plus" /> Clue
            </button>
            {openMystery.solvedAt ? (
              <button type="button" className="btn" onClick={() => run(() => mysteries.updateItem(openMystery.id, { solved_at: null }))}>
                <Icon name="undo" /> Reopen
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => setDialog({ kind: 'solve', mystery: openMystery })}>
                <Icon name="check" /> Mark solved
              </button>
            )}
          </div>
        </header>

        {openMystery.solvedAt && (
          <div className="mystery-answer">
            <h3>
              <Icon name="check" /> The answer
            </h3>
            {openMystery.answer ? <RichText value={openMystery.answer} /> : <p className="empty-state">No answer written.</p>}
            <div className="mystery-answer__actions">
              <button type="button" className="btn btn--text" onClick={() => setDialog({ kind: 'solve', mystery: openMystery })}>
                <Icon name="edit" /> Edit answer
              </button>
              {openMystery.loreId && (
                <button type="button" className="btn btn--text" onClick={() => onShowLore(openMystery.loreId)}>
                  <Icon name="scroll" /> See it in Lore
                </button>
              )}
            </div>
          </div>
        )}
        {actionError && <p className="empty-state empty-state--error">{actionError}</p>}

        <div className="mystery-detail__cols">
          <section className="mystery-detail__clues" aria-label="Clues">
            {mClues.length === 0 && (
              <p className="empty-state">No clues yet. Add one, or file a loose clue here from the board.</p>
            )}
            {groupClues(mClues)
              .filter((g) => g.clues.length > 0)
              .map((g) => (
                <div key={g.id} className="mystery-group">
                  <h3 className={`mystery-group__title mystery-group__title--${g.id}`}>
                    {g.id === 'herring' ? 'Red herrings' : g.id === 'lead' ? 'Leads' : g.label}{' '}
                    <span>{g.clues.length}</span>
                  </h3>
                  {g.clues.map((clue) => (
                    <article key={clue.id} id={`clue-${clue.id}`} className={`clue-card clue-card--${g.id}`}>
                      <div className="clue-card__top">
                        <p className="clue-card__text">{clue.title}</p>
                        <label className="clue-card__status">
                          <span className="sr-only">Status of “{clue.title}”</span>
                          <select value={clueStatus(clue.clueStatus).id} onChange={(e) => setStatus(clue.id, e.target.value)}>
                            {CLUE_STATUSES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {clue.notes && <RichText className="clue-card__notes" value={clue.notes} />}
                      <div className="clue-card__foot">
                        <span className="clue-found">{foundLabel(clue)}</span>
                        <span className="clue-card__tools">
                          <button type="button" className="btn btn--text" onClick={() => fileClue(clue.id, null)}>
                            Unfile
                          </button>
                          <button type="button" className="btn btn--text" onClick={() => setDialog({ kind: 'clue', clue })}>
                            <Icon name="edit" /> Edit
                          </button>
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ))}
          </section>

          <aside className="mystery-detail__theories" aria-label="Theories">
            <div className="mystery-detail__theories-head">
              <h3>Theories</h3>
              <button type="button" className="btn" onClick={() => setDialog({ kind: 'theory', mysteryId: openMystery.id })}>
                <Icon name="plus" /> Theory
              </button>
            </div>
            {ranked.length === 0 && <p className="empty-state">What does the party think? Pitch a theory.</p>}
            {ranked.map((t, i) => (
              <article key={t.id} className={`theory${i === 0 && t.votes > 0 ? ' theory--leading' : ''}`}>
                <div className="theory__top">
                  <div>
                    {i === 0 && t.votes > 0 && <p className="mystery__eyebrow">Party’s best guess</p>}
                    <h4 className="theory__text">{t.text}</h4>
                    <p className="theory__by">
                      Pitched by {t.authorName || 'someone'}
                      {t.foundIn ? ` · ${t.foundIn}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`theory__vote${t.voted ? ' is-on' : ''}`}
                    aria-pressed={t.voted}
                    aria-label={`Agree with “${t.text}”, ${t.votes} vote${t.votes === 1 ? '' : 's'}`}
                    onClick={() => toggleVote(t)}
                    disabled={!playerId}
                  >
                    <Icon name="next" />
                    {t.votes}
                  </button>
                </div>
                <TheoryEvidence label="Supports" tone="for" ids={t.supports} byId={byId} />
                <TheoryEvidence label="Against" tone="against" ids={t.against} byId={byId} />
                <button type="button" className="btn btn--text theory__edit" onClick={() => setDialog({ kind: 'theory', mysteryId: openMystery.id, theory: t })}>
                  <Icon name="edit" /> Edit
                </button>
              </article>
            ))}
          </aside>
        </div>
        {dialogs}
      </section>
    )
  }

  return (
    <div className="mystery-board">
      <div className="mystery-board__toolbar">
        <button type="button" className="btn" onClick={() => setDialog({ kind: 'clue', mysteryId: null })}>
          <Icon name="plus" /> Clue
        </button>
        <button type="button" className="btn btn--primary" onClick={() => setDialog({ kind: 'mystery' })}>
          <Icon name="plus" /> Mystery
        </button>
      </div>
      {actionError && <p className="empty-state empty-state--error">{actionError}</p>}
      <div className="mystery-board__layout">
        <aside className="loose-tray" aria-label="Loose clues">
          <div className="loose-tray__head">
            <h3>Loose clues</h3>
            <span className="loose-tray__count">{loose.length}</span>
          </div>
          <p className="loose-tray__hint">
            {loose.length
              ? 'Not tied to a mystery yet. Drag one onto a mystery, or choose where it belongs.'
              : 'Clues you jot down without a mystery wait here.'}
          </p>
          {loose.map((clue) => (
            <article
              key={clue.id}
              className={`loose-clue${dragId === clue.id ? ' is-dragging' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', clue.id)
                e.dataTransfer.effectAllowed = 'move'
                setDragId(clue.id)
              }}
              onDragEnd={() => {
                setDragId(null)
                setDropId(null)
              }}
            >
              <button type="button" className="loose-clue__text" onClick={() => setDialog({ kind: 'clue', clue })}>
                {clue.title}
              </button>
              <div className="loose-clue__foot">
                <span className="clue-found">{foundLabel(clue)}</span>
                <label className="loose-clue__file">
                  <span className="sr-only">Which mystery does “{clue.title}” belong to?</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '__new') setDialog({ kind: 'mystery', fileClue: clue.id })
                      else if (v) fileClue(clue.id, v)
                    }}
                  >
                    <option value="">Belongs to…</option>
                    {open.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.question}
                      </option>
                    ))}
                    <option value="__new">+ New mystery</option>
                  </select>
                </label>
              </div>
            </article>
          ))}
          <button type="button" className="btn btn--text loose-tray__add" onClick={() => setDialog({ kind: 'clue', mysteryId: null })}>
            <Icon name="plus" /> Clue
          </button>
        </aside>

        <section className="mystery-grid" aria-label="Open mysteries">
          {mysteries.loading && <p className="empty-state">Loading…</p>}
          {!mysteries.loading && open.length === 0 && (
            <div className="mystery-empty panel">
              <h3>No open mysteries</h3>
              <p>A mystery is a question the party wants answered: “Who hired the assassins?”</p>
              <button type="button" className="btn btn--primary" onClick={() => setDialog({ kind: 'mystery' })}>
                <Icon name="plus" /> Mystery
              </button>
            </div>
          )}
          {open.map((m) => {
            const mClues = cluesFor(m.id)
            const ranked = theoriesFor(m.id)
            const leading = ranked[0]?.votes > 0 ? ranked[0] : null
            const quiet = quietSince(m, mClues, ranked)
            const dragging = dragId && loose.some((c) => c.id === dragId)
            return (
              <article
                key={m.id}
                className={`mystery-card panel${dropId === m.id ? ' is-drop' : ''}${dragging ? ' is-target' : ''}`}
                {...dropProps(m.id)}
              >
                <p className="mystery__eyebrow">
                  {mClues.length} clue{mClues.length === 1 ? '' : 's'} · {ranked.length || 'no'} theor
                  {ranked.length === 1 ? 'y' : 'ies'}
                </p>
                <h3 className="mystery-card__question">
                  <button type="button" onClick={() => setOpenId(m.id)}>
                    {m.question}
                  </button>
                </h3>
                {mClues.length > 0 && (
                  <ul className="mystery-card__clues">
                    {mClues.slice(0, 4).map((c) => {
                      const s = clueStatus(c.clueStatus)
                      return (
                        <li key={c.id} className={`mystery-card__clue mystery-card__clue--${s.id}`}>
                          <span className={`clue-chip clue-chip--${s.id}`}>{s.label}</span>
                          <span>
                            <span className="mystery-card__clue-text">{c.title}</span>{' '}
                            <span className="clue-found">{foundLabel(c)}</span>
                          </span>
                        </li>
                      )
                    })}
                    {mClues.length > 4 && <li className="mystery-card__more">+{mClues.length - 4} more</li>}
                  </ul>
                )}
                {dropId === m.id && <p className="mystery-card__drop">Drop to add it here</p>}
                {leading && (
                  <p className="mystery-card__leading">
                    <Icon name="lightbulb" />
                    <span>
                      Leading theory: <strong>{leading.text}</strong>
                    </span>
                    <span className="clue-found">
                      {leading.votes} vote{leading.votes === 1 ? '' : 's'}
                    </span>
                  </p>
                )}
                {quiet && <p className="mystery-card__quiet">Quiet since {quiet}. Worth a nudge?</p>}
                <div className="mystery-card__actions">
                  <button type="button" className="btn btn--text" onClick={() => setDialog({ kind: 'clue', mysteryId: m.id })}>
                    <Icon name="plus" /> Clue
                  </button>
                  <button type="button" className="btn" onClick={() => setOpenId(m.id)}>
                    Open
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      </div>

      {solved.length > 0 && (
        <section className="mystery-solved" aria-label="Solved mysteries">
          <h3 className="mystery-solved__title">
            Solved <span>{solved.length}</span>
          </h3>
          <div className="mystery-solved__list">
            {solved.map((m) => (
              <button key={m.id} type="button" className="solved-card" onClick={() => setOpenId(m.id)}>
                <span className="solved-card__stamp" aria-hidden="true">
                  {stampText(m.solvedIn)}
                </span>
                <span className="solved-card__body">
                  <span className="solved-card__question">{m.question}</span>
                  <span className="solved-card__answer">{answerPreview(m.answer)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {dialogs}
    </div>
  )
}

// "Session 14" → "S14" for the round stamp; anything else, a tick.
const stampText = (label) => (/^session\s+(\d+)$/i.test(label || '') ? `S${label.match(/\d+/)[0]}` : '✓')

function answerPreview(html) {
  const text = new DOMParser().parseFromString(html || '', 'text/html').body.textContent.trim()
  if (!text) return 'Solved.'
  return text.length > 110 ? `${text.slice(0, 110)}…` : text
}

function TheoryEvidence({ label, tone, ids, byId }) {
  const found = (ids || []).map((id) => byId.get(id)).filter(Boolean)
  return (
    <p className={`theory__evidence theory__evidence--${tone}`}>
      <span className="theory__evidence-label">{label}</span>
      <span>
        {found.length === 0 && <em>nothing yet</em>}
        {found.map((c, i) => (
          <span key={c.id}>
            {i > 0 && ', '}
            <a
              href={`#clue-${c.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(`clue-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
            >
              {c.title}
            </a>
          </span>
        ))}
      </span>
    </p>
  )
}

function FormShell({ label, onClose, onSubmit, onDelete, submitLabel, children }) {
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  return (
    <Modal onClose={onClose} label={label}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (saving) return
          setSaving(true)
          setError(null)
          try {
            await onSubmit()
          } catch (err) {
            setError(err.message)
            setSaving(false)
          }
        }}
      >
        <h3 className="section-card__title">{label}</h3>
        {children}
        {error && <p className="empty-state empty-state--error">{error}</p>}
        <div className="form-actions">
          {onDelete && (
            <button type="button" className="btn btn--danger form-delete" onClick={onDelete}>
              Delete
            </button>
          )}
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function MysteryForm({ mystery, onClose, onSave }) {
  const [question, setQuestion] = useState(mystery?.question || '')
  return (
    <FormShell
      label={mystery ? 'Rename mystery' : 'New mystery'}
      submitLabel={mystery ? 'Save' : 'Add mystery'}
      onClose={onClose}
      onSubmit={() => question.trim() && onSave(question.trim())}
    >
      <div className="field">
        <label htmlFor="mystery-question">The question</label>
        <input
          id="mystery-question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Who hired the assassins at the Gilded Fox?"
          required
          autoFocus
        />
      </div>
    </FormShell>
  )
}

function ClueForm({ clue, mysteryId, mysteries, currentSession, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(clue?.title || '')
  const [notes, setNotes] = useState(clue?.notes || '')
  const [status, setStatus] = useState(clueStatus(clue?.clueStatus).id)
  const [foundIn, setFoundIn] = useState(clue ? clue.foundIn || '' : currentSession)
  const [belongs, setBelongs] = useState(clue ? clue.mysteryId || '' : mysteryId || '')
  return (
    <FormShell
      label={clue ? 'Edit clue' : 'New clue'}
      submitLabel={clue ? 'Save' : 'Add clue'}
      onClose={onClose}
      onDelete={onDelete}
      onSubmit={() =>
        title.trim() &&
        onSave({ title: title.trim(), notes, clue_status: status, found_in: foundIn.trim(), mystery_id: belongs || null })
      }
    >
      <div className="field">
        <label htmlFor="clue-title">What did you notice?</label>
        <input
          id="clue-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="The innkeeper flinched at the name Vael"
          required
          autoFocus
        />
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="clue-status">Status</label>
          <select id="clue-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {CLUE_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="clue-found">Found in</label>
          <input
            id="clue-found"
            type="text"
            value={foundIn}
            onChange={(e) => setFoundIn(e.target.value)}
            placeholder="Session 14"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="clue-mystery">Belongs to</label>
        <select id="clue-mystery" value={belongs} onChange={(e) => setBelongs(e.target.value)}>
          <option value="">Loose for now</option>
          {mysteries.map((m) => (
            <option key={m.id} value={m.id}>
              {m.question}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="clue-notes">Details</label>
        <RichTextEditor
          id="clue-notes"
          value={notes}
          onChange={setNotes}
          ariaLabel="Details"
          placeholder="Who told you, where it was, what it might mean… Use ~ to tag people and places."
        />
      </div>
    </FormShell>
  )
}

function TheoryForm({ theory, clues, onClose, onSave, onDelete }) {
  const [text, setText] = useState(theory?.text || '')
  const [stance, setStance] = useState(() => {
    const s = {}
    for (const id of theory?.supports || []) s[id] = 'for'
    for (const id of theory?.against || []) s[id] = 'against'
    return s
  })
  const pick = (id) => Object.keys(stance).filter((k) => stance[k] === id)
  return (
    <FormShell
      label={theory ? 'Edit theory' : 'New theory'}
      submitLabel={theory ? 'Save' : 'Add theory'}
      onClose={onClose}
      onDelete={onDelete}
      onSubmit={() => text.trim() && onSave({ text: text.trim(), supports: pick('for'), against: pick('against') })}
    >
      <div className="field">
        <label htmlFor="theory-text">Your theory</label>
        <input
          id="theory-text"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="It's Duke Aldric"
          required
          autoFocus
        />
      </div>
      {clues.length > 0 && (
        <fieldset className="theory-form__clues">
          <legend>How do the clues fit?</legend>
          {clues.map((c) => (
            <div key={c.id} className="theory-form__clue">
              <span>{c.title}</span>
              <select
                aria-label={`How “${c.title}” fits this theory`}
                value={stance[c.id] || ''}
                onChange={(e) => setStance((s) => ({ ...s, [c.id]: e.target.value }))}
              >
                <option value="">Doesn’t matter</option>
                <option value="for">Supports it</option>
                <option value="against">Argues against</option>
              </select>
            </div>
          ))}
        </fieldset>
      )}
    </FormShell>
  )
}

function SolveForm({ mystery, currentSession, onClose, onSave }) {
  const [answer, setAnswer] = useState(mystery.answer || '')
  const [solvedIn, setSolvedIn] = useState(mystery.solvedIn || currentSession)
  return (
    <FormShell
      label={mystery.solvedAt ? 'Edit the answer' : 'Solve the mystery'}
      submitLabel={mystery.solvedAt ? 'Save' : 'Mark solved'}
      onClose={onClose}
      onSubmit={() => onSave({ answer, solvedIn: solvedIn.trim() })}
    >
      <p className="mystery-form__question">{mystery.question}</p>
      <div className="field">
        <label htmlFor="solve-answer">The answer</label>
        <RichTextEditor
          id="solve-answer"
          value={answer}
          onChange={setAnswer}
          ariaLabel="The answer"
          placeholder="Brother Hal took it, to pay a debt to the Guild…"
        />
      </div>
      <div className="field">
        <label htmlFor="solve-in">Solved in</label>
        <input id="solve-in" type="text" value={solvedIn} onChange={(e) => setSolvedIn(e.target.value)} placeholder="Session 14" />
      </div>
      <p className="field-hint">The answer is also saved to Lore, linked back to this mystery.</p>
    </FormShell>
  )
}

export default MysteryBoard
