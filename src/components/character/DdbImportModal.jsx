import { useRef, useState } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { useSupabaseTable } from '../../hooks/useSupabaseTable.js'
import {
  IMPORT_SECTIONS,
  applyImport,
  characterServiceUrl,
  fetchDdbCharacter,
  mapDdbCharacter,
  parseCharacterId,
  parseCharacterJson,
} from '../../lib/ddbImport.js'
import { ABILITIES, formatModifier, abilityModifier } from '../../lib/character.js'
import Modal from '../Modal.jsx'

const spellFromRow = (r) => ({ id: r.id, name: r.name })

function Preview({ imported }) {
  const m = imported.mechanics
  const slotText = Object.entries(m.spellSlots)
    .map(([lvl, s]) => `L${lvl}×${s.max}`)
    .join(' ')
  const rows = [
    ['Character', `${imported.identity.name} — ${imported.identity.raceClass}, level ${imported.identity.level}`],
    ['Abilities', ABILITIES.map((a) => `${a.short} ${m.abilities[a.id] ?? '—'} (${formatModifier(abilityModifier(m.abilities[a.id]))})`).join(' · ')],
    ['HP', m.hp.max === null ? '— (enter it yourself)' : `${m.hp.current} / ${m.hp.max}`],
    ['AC', m.ac ?? '—'],
    ['Speed', m.speed === null ? '—' : `${m.speed} ft`],
    ['Proficient skills', Object.keys(m.skills).length || 'none'],
    ['Spell slots', slotText || 'none'],
    ['Resources', m.resources.map((r) => r.name).join(', ') || 'none'],
    ['Inventory', `${m.inventory.length} item${m.inventory.length === 1 ? '' : 's'}`],
    ['Spells', `${imported.spells.length}`],
  ]
  return (
    <dl className="ddb-import__preview mechanics">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// Pull a character from D&D Beyond into this app: paste the character's
// link (fetched through /api/ddb-character), or upload the JSON file as a
// fallback. Shows what will change and lets the player pick sections
// before anything is written.
function DdbImportModal({ character, sheetApi, onClose }) {
  const { campaignId, playerId, tables } = useCampaignData()
  const spells = useSupabaseTable('spells', {
    fromRow: spellFromRow,
    filters: playerId ? { campaign_id: campaignId, player_id: playerId } : { campaign_id: campaignId },
  })
  const [link, setLink] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [pasted, setPasted] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | preview | saving | done
  const [error, setError] = useState(null)
  const [imported, setImported] = useState(null)
  const [sections, setSections] = useState(IMPORT_SECTIONS.map((s) => s.id))
  const [updateRoster, setUpdateRoster] = useState(true)
  const [addSpells, setAddSpells] = useState(Boolean(playerId))
  const [result, setResult] = useState(null)
  const abortRef = useRef(null)

  const linkId = parseCharacterId(link)

  function load(ddb) {
    const mapped = mapDdbCharacter(ddb)
    setImported(mapped)
    setStatus('preview')
    setError(null)
  }

  async function importFromLink(event) {
    event.preventDefault()
    if (!linkId) {
      setError('Paste your character’s D&D Beyond link (it ends in a number), or just the number.')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('loading')
    setError(null)
    try {
      load(await fetchDdbCharacter(linkId, { signal: controller.signal }))
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
      setStatus('idle')
    }
  }

  function importFromText(text) {
    try {
      load(parseCharacterJson(text))
    } catch (err) {
      setError(err.message)
    }
  }

  async function onFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('That file is too large to be a character sheet.')
      return
    }
    importFromText(await file.text())
  }

  async function confirm() {
    setStatus('saving')
    setError(null)
    const summary = { sheet: sections.length > 0, roster: false, spellsAdded: 0, spellsSkipped: 0 }
    try {
      if (sections.length) sheetApi.update((sheet) => applyImport(sheet, imported, sections))
      if (updateRoster) {
        await tables.character.updateItem(character.id, {
          race_class: imported.identity.raceClass,
          level: imported.identity.level,
        })
        summary.roster = true
      }
      if (addSpells && playerId) {
        const have = new Set(spells.items.map((s) => s.name.trim().toLowerCase()))
        for (const spell of imported.spells) {
          if (have.has(spell.name.toLowerCase())) {
            summary.spellsSkipped += 1
            continue
          }
          await spells.addItem(spell)
          have.add(spell.name.toLowerCase())
          summary.spellsAdded += 1
        }
      }
      setResult(summary)
      setStatus('done')
    } catch (err) {
      setError(`Import stopped partway: ${err.message}`)
      setStatus('preview')
    }
  }

  const toggleSection = (id) =>
    setSections((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <Modal onClose={onClose} label="Import from D&D Beyond">
      <div className="ddb-import form-stack">
        <h3 className="section-card__title">Import from D&amp;D Beyond</h3>

        {(status === 'idle' || status === 'loading') && (
          <>
            <ol className="ddb-import__steps">
              <li>
                On D&amp;D Beyond, open your character → <strong>Manage</strong> → <strong>Settings</strong> and set
                Character Privacy to <strong>Public</strong>.
              </li>
              <li>Copy the character’s link from the address bar and paste it here.</li>
            </ol>
            <form className="form-stack" onSubmit={importFromLink} noValidate>
              <div className="field">
                <label htmlFor="ddb-link">Character link</label>
                <input
                  id="ddb-link"
                  type="url"
                  inputMode="url"
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value)
                    setError(null)
                  }}
                  placeholder="https://www.dndbeyond.com/characters/12345678"
                  autoFocus
                />
              </div>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn--text" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={status === 'loading'}>
                  {status === 'loading' ? 'Fetching…' : 'Import'}
                </button>
              </div>
            </form>

            <details className="ddb-import__upload" open={showUpload} onToggle={(e) => setShowUpload(e.currentTarget.open)}>
              <summary>Upload a file instead</summary>
              <p className="field-hint">
                If the link doesn’t work, open{' '}
                {linkId ? (
                  <a href={characterServiceUrl(linkId)} target="_blank" rel="noreferrer">
                    your character’s data page
                  </a>
                ) : (
                  <code>character-service.dndbeyond.com/character/v5/character/&lt;your ID&gt;</code>
                )}{' '}
                (paste your link above first to get a direct link), save it with <kbd>Ctrl/⌘ + S</kbd>, then choose
                the file — or copy all the text and paste it below.
              </p>
              <input type="file" accept="application/json,.json,.txt" onChange={onFile} aria-label="Character file" />
              <div className="field">
                <label htmlFor="ddb-paste">…or paste the text</label>
                <textarea id="ddb-paste" className="field--wide" rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn" disabled={!pasted.trim()} onClick={() => importFromText(pasted)}>
                  Read pasted text
                </button>
              </div>
            </details>
          </>
        )}

        {(status === 'preview' || status === 'saving') && imported && (
          <>
            <p>Here&apos;s what D&amp;D Beyond has for this character. Choose what to bring into {character.name}&apos;s sheet:</p>
            <Preview imported={imported} />
            {imported.warnings.length > 0 && (
              <ul className="ddb-import__warnings">
                {imported.warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            )}
            <fieldset className="ddb-import__choices">
              <legend>Import into the sheet</legend>
              {IMPORT_SECTIONS.map((s) => (
                <label key={s.id}>
                  <input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggleSection(s.id)} />
                  {s.label}
                </label>
              ))}
              <label>
                <input type="checkbox" checked={updateRoster} onChange={(e) => setUpdateRoster(e.target.checked)} />
                Update race/class and level on the Party roster
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={addSpells}
                  disabled={!playerId}
                  onChange={(e) => setAddSpells(e.target.checked)}
                />
                Add {imported.spells.length} spell{imported.spells.length === 1 ? '' : 's'} to my Spells (skips ones already there)
                {!playerId && ' — players only'}
              </label>
            </fieldset>
            <p className="field-hint">
              Selected mechanics replace what&apos;s on the sheet. Roleplay text only fills empty fields, and nothing
              is ever sent back to D&amp;D Beyond.
            </p>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn--text" onClick={() => setStatus('idle')} disabled={status === 'saving'}>
                Back
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={confirm}
                disabled={status === 'saving' || (!sections.length && !updateRoster && !addSpells)}
              >
                {status === 'saving' ? 'Importing…' : 'Import selected'}
              </button>
            </div>
          </>
        )}

        {status === 'done' && result && (
          <>
            <p role="status">✓ Imported from D&amp;D Beyond.</p>
            <ul className="ddb-import__summary">
              {result.sheet && <li>Character sheet updated (saving automatically).</li>}
              {result.roster && <li>Party roster updated.</li>}
              {addSpells && playerId && (
                <li>
                  {result.spellsAdded} spell{result.spellsAdded === 1 ? '' : 's'} added
                  {result.spellsSkipped ? `, ${result.spellsSkipped} already there` : ''}.
                </li>
              )}
            </ul>
            <div className="form-actions">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default DdbImportModal
