import { useState } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { SectionCard } from '../ui.jsx'
import './PartyLevelUp.scss'

const MAX_LEVEL = 20

// The DM's "Level up the party" button on the Combat tab: raises the
// ticked player characters by one level each. Every player sees the
// level-up celebration (LevelUp.jsx) the moment it saves.
function PartyLevelUp() {
  const { tables } = useCampaignData()
  const { items, updateItem } = tables.character
  const characters = items
    .filter((m) => m.member_type !== 'NPC')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const [skipped, setSkipped] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { ok, text }

  const levelOf = (m) => Number(m.level) || 1
  const eligible = characters.filter((m) => levelOf(m) < MAX_LEVEL)
  const chosen = eligible.filter((m) => !skipped.has(m.id))

  function toggle(id) {
    setMessage(null)
    setSkipped((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function levelUp() {
    if (!chosen.length || busy) return
    const list = chosen.map((m) => `${m.name || 'Unnamed'} → Level ${levelOf(m) + 1}`).join('\n')
    if (!window.confirm(`Level up ${chosen.length === 1 ? 'this character' : `these ${chosen.length} characters`}?\n\n${list}`)) return
    setBusy(true)
    setMessage(null)
    const failed = []
    for (const m of chosen) {
      try {
        await updateItem(m.id, { level: levelOf(m) + 1 })
      } catch {
        failed.push(m.name || 'Unnamed')
      }
    }
    setBusy(false)
    setMessage(
      failed.length
        ? { ok: false, text: `Couldn’t level up ${failed.join(', ')}. Try again.` }
        : { ok: true, text: `Done — ${chosen.length === 1 ? '1 character' : `${chosen.length} characters`} levelled up.` },
    )
  }

  return (
    <SectionCard title="Level up the party" icon="star" className="party-level-up">
      {characters.length === 0 ? (
        <p className="empty-state">No player characters in the party yet.</p>
      ) : (
        <>
          <ul className="party-level-up__list">
            {characters.map((m) => {
              const maxed = levelOf(m) >= MAX_LEVEL
              return (
                <li key={m.id}>
                  <label className={`party-level-up__row${maxed ? ' party-level-up__row--maxed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!maxed && !skipped.has(m.id)}
                      disabled={maxed || busy}
                      onChange={() => toggle(m.id)}
                    />
                    <span className="party-level-up__name">{m.name || 'Unnamed'}</span>
                    <span className="party-level-up__level">
                      {maxed ? `Level ${MAX_LEVEL} (max)` : `Level ${levelOf(m)} → ${levelOf(m) + 1}`}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {message && (
            <p className={`party-level-up__message${message.ok ? '' : ' party-level-up__message--error'}`} role="status">
              {message.text}
            </p>
          )}
          <button type="button" className="btn btn--primary party-level-up__go" onClick={levelUp} disabled={busy || !chosen.length}>
            {busy ? 'Levelling up…' : `Level up ${chosen.length === eligible.length ? 'the party' : `${chosen.length} selected`}`}
          </button>
        </>
      )}
    </SectionCard>
  )
}

export default PartyLevelUp
