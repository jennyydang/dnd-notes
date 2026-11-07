import { useMemo, useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { entityKey } from '../lib/entities.js'
import {
  LANGUAGES,
  TERM_KINDS,
  dictionaryMarkdown,
  groupByLetter,
  matchesTerm,
  missingNames,
  termFromRow,
} from '../lib/dictionary.js'
import { downloadFile, safeFileName } from '../lib/exportNotes.js'
import { confirmDelete } from '../lib/confirm.js'
import { EntityChip, FilterSelect } from './ui.jsx'
import LinkPicker from './LinkPicker.jsx'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import './DictionaryTab.scss'

const ALL = 'all'
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window
const emptyForm = { term: '', pronunciation: '', kind: 'Word', language: '', meaning: '', notes: '' }

// Reads a word aloud: its respelling if it has one ("eye-REE-nuh"), so the
// voice gets close to how the table says it.
function speak(t) {
  if (!canSpeak()) return
  const say = t.pronunciation ? t.pronunciation.replace(/[-·.]/g, ' ') : t.term
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(say)
  u.rate = 0.85
  window.speechSynthesis.speak(u)
}

// The world's dictionary: words the setting uses, names and how to say
// them, titles, phrases. A–Z, searchable, each word linkable to the entry
// it belongs to. Names already in the journal without a pronunciation are
// offered up to add.
function DictionaryTab({ campaignName }) {
  const data = useCampaignData()
  const nav = useCampaignNav()
  const table = data.tables.term
  const terms = useMemo(() => (table?.items || []).map(termFromRow), [table?.items])
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState(ALL)
  const [editing, setEditing] = useState(null) // { id|null, form, link }
  const [error, setError] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(true)

  const languages = useMemo(
    () => [...new Set(terms.map((t) => t.language).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [terms],
  )
  const shown = terms.filter((t) => matchesTerm(t, query) && (language === ALL || t.language === language))
  const groups = groupByLetter(shown)
  const present = new Set(groups.map((g) => g.letter))
  const suggestions = missingNames(data.entities, terms)

  // Entries each word is linked to (either direction).
  const linkedTo = (id) =>
    data.links
      .filter((l) => (l.source_type === 'term' && l.source_id === id) || (l.target_type === 'term' && l.target_id === id))
      .map((l) => {
        const [type, otherId] = l.source_type === 'term' && l.source_id === id ? [l.target_type, l.target_id] : [l.source_type, l.source_id]
        return { link: l, entity: data.byKey.get(entityKey(type, otherId)) || null }
      })

  async function save(form, link, id) {
    const row = {
      term: form.term.trim(),
      pronunciation: form.pronunciation.trim(),
      kind: form.kind,
      language: form.language.trim(),
      meaning: form.meaning.trim(),
      notes: form.notes.trim(),
    }
    let saved
    if (id) saved = await table.updateItem(id, row)
    else saved = await table.addItem({ ...row, ...(data.playerId ? { created_by: data.playerId } : {}) })
    const termId = id || saved.id
    if (link && !linkedTo(termId).some((l) => l.entity?.type === link.type && l.entity?.id === link.id)) {
      await data.linkEntities({ type: 'term', id: termId }, link, '')
    }
  }

  async function remove(t) {
    if (!confirmDelete(`“${t.term}” from the dictionary`)) return
    try {
      await table.removeItem(t.id)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!table) return null
  const missingTable = table.error && /dictionary_terms/.test(table.error)

  return (
    <section className="dictionary">
      <div className="dictionary__toolbar">
        <input
          type="search"
          className="dictionary__search"
          placeholder="Search words, meanings, how to say it…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the dictionary"
        />
        {languages.length > 0 && (
          <FilterSelect
            icon="speech"
            label="Language"
            value={language}
            options={[{ id: ALL, label: 'All' }, ...languages.map((l) => ({ id: l, label: l }))]}
            onChange={setLanguage}
            active={language !== ALL}
            onClear={() => setLanguage(ALL)}
          />
        )}
        <div className="dictionary__actions">
          {terms.length > 0 && (
            <button
              type="button"
              className="btn btn--text"
              onClick={() =>
                downloadFile(
                  `${safeFileName(campaignName || 'world')}-dictionary.md`,
                  dictionaryMarkdown(terms, `${campaignName || 'World'} dictionary`),
                  'text/markdown;charset=utf-8',
                )
              }
            >
              <Icon name="download" /> Download
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={() => setEditing({ id: null, form: emptyForm, link: null })}>
            <Icon name="plus" /> Add word
          </button>
        </div>
      </div>

      {missingTable && <p className="field-error">Run the latest supabase/schema.sql first (it adds the dictionary).</p>}
      {error && <p className="field-error">{error}</p>}

      {suggestions.length > 0 && (
        <section className="dictionary__suggest panel">
          <header className="dictionary__suggest-head">
            <h3>
              <Icon name="lightbulb" /> Names in your world without a pronunciation
            </h3>
            <button type="button" className="btn btn--text" onClick={() => setShowSuggestions((s) => !s)} aria-expanded={showSuggestions}>
              {showSuggestions ? 'Hide' : 'Show'}
            </button>
          </header>
          {showSuggestions && (
            <ul className="chip-row dictionary__suggest-list">
              {suggestions.map((s) => (
                <li key={entityKey(s.entity.type, s.entity.id)}>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setEditing({ id: null, form: { ...emptyForm, term: s.name, kind: s.kind }, link: s.entity })}
                  >
                    <Icon name={s.entity.icon} /> {s.name}
                    <Icon name="plus" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {terms.length > 0 && (
        <nav className="dictionary__letters" aria-label="Jump to letter">
          {LETTERS.map((l) =>
            present.has(l) ? (
              <a key={l} href={`#dict-${l}`} className="dictionary__letter">
                {l}
              </a>
            ) : (
              <span key={l} className="dictionary__letter is-empty" aria-hidden="true">
                {l}
              </span>
            ),
          )}
        </nav>
      )}

      {!table.loading && terms.length === 0 && !missingTable && (
        <div className="empty-state">
          <p>No words yet.</p>
          <p>Add the names your table keeps tripping over, the setting’s own words, titles and phrases — with how to say them.</p>
        </div>
      )}
      {terms.length > 0 && shown.length === 0 && <p className="empty-state">No words match.</p>}

      {groups.map(({ letter, terms: list }) => (
        <section key={letter} className="dictionary__group" id={`dict-${letter}`} aria-label={letter}>
          <h3 className="dictionary__group-letter">{letter}</h3>
          <dl className="dictionary__entries">
            {list.map((t) => {
              const linked = linkedTo(t.id)
              return (
                <div key={t.id} className="dictionary__entry">
                  <dt className="dictionary__head">
                    <span className="dictionary__term">{t.term}</span>
                    {t.pronunciation && <span className="dictionary__say">/{t.pronunciation}/</span>}
                    {canSpeak() && (
                      <button type="button" className="icon-btn dictionary__speak" onClick={() => speak(t)} aria-label={`Say ${t.term}`}>
                        <Icon name="speech" />
                      </button>
                    )}
                    <span className="dictionary__meta">{[t.kind, t.language].filter(Boolean).join(' · ')}</span>
                    <span className="dictionary__tools">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Edit ${t.term}`}
                        onClick={() => setEditing({ id: t.id, form: { ...emptyForm, ...t }, link: null })}
                      >
                        <Icon name="edit" />
                      </button>
                      <button type="button" className="icon-btn" aria-label={`Delete ${t.term}`} onClick={() => remove(t)}>
                        <Icon name="trash" />
                      </button>
                    </span>
                  </dt>
                  <dd className="dictionary__body">
                    {t.meaning ? <p className="dictionary__meaning">{t.meaning}</p> : <p className="dictionary__meaning is-empty">No meaning yet.</p>}
                    {t.notes && <p className="dictionary__notes">{t.notes}</p>}
                    {linked.length > 0 && (
                      <div className="dictionary__links">
                        {linked.map(({ link, entity }) => (
                          <EntityChip key={link.id} entity={entity} onOpen={(e) => nav.openEntity(e.type, e.id)} />
                        ))}
                      </div>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}

      {editing && (
        <TermForm
          editing={editing}
          languages={[...new Set([...languages, ...LANGUAGES])]}
          existing={terms}
          onClose={() => setEditing(null)}
          onSave={async (form, link) => {
            await save(form, link, editing.id)
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

function TermForm({ editing, languages, existing, onClose, onSave }) {
  const [form, setForm] = useState(editing.form)
  const [link, setLink] = useState(editing.link)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const duplicate =
    !editing.id && existing.some((t) => t.term.trim().toLowerCase() === form.term.trim().toLowerCase() && form.term.trim())

  async function submit(event) {
    event.preventDefault()
    if (!form.term.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave(form, link)
    } catch (err) {
      setError(/dictionary_terms/.test(err.message) ? 'Run the latest supabase/schema.sql first (it adds the dictionary).' : err.message)
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} label={editing.id ? 'Edit word' : 'Add word'} size="narrow">
      <form className="form-stack" onSubmit={submit}>
        <h3 className="section-card__title">
          <Icon name="speech" /> {editing.id ? 'Edit word' : 'Add a word'}
        </h3>
        <div className="field">
          <label htmlFor="dict-term">Word</label>
          <input id="dict-term" value={form.term} onChange={set('term')} placeholder="Vistani" autoFocus maxLength={120} />
          {duplicate && <p className="field-hint">That word’s already in the dictionary.</p>}
        </div>
        <div className="field">
          <label htmlFor="dict-say">How to say it</label>
          <input id="dict-say" value={form.pronunciation} onChange={set('pronunciation')} placeholder="vis-TAH-nee" maxLength={120} />
          <p className="field-hint">Spell it how it sounds; capitals for the stressed part.</p>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="dict-kind">Kind</label>
            <select id="dict-kind" value={form.kind} onChange={set('kind')}>
              {TERM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="dict-language">Language</label>
            <input id="dict-language" value={form.language} onChange={set('language')} list="dict-languages" placeholder="Common" maxLength={60} />
            <datalist id="dict-languages">
              {languages.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="field">
          <label htmlFor="dict-meaning">Meaning</label>
          <textarea id="dict-meaning" rows={3} value={form.meaning} onChange={set('meaning')} placeholder="The wandering folk of Barovia, travellers and fortune-tellers." />
        </div>
        <div className="field">
          <label htmlFor="dict-notes">Example or notes</label>
          <textarea id="dict-notes" rows={2} value={form.notes} onChange={set('notes')} placeholder="“The Vistani know the way through the mists.”" />
        </div>
        <LinkPicker label="Belongs to (optional)" value={link} onChange={setLink} showRelation={false} />
        {error && <p className="field-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !form.term.trim()}>
            {saving ? 'Saving…' : editing.id ? 'Save' : 'Add word'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default DictionaryTab
