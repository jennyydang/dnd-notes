import { useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { useActiveCharacter } from '../hooks/useActiveCharacter.js'
import { useCharacterSheet } from '../hooks/useCharacterSheet.js'
import { usePrep } from '../hooks/usePrep.js'
import { useQuickNotes } from '../hooks/useQuickNotes.js'
import { getPublicUrl } from '../lib/storage.js'
import { formatSessionDate, sessionDateTimestamp } from '../lib/sessionNotes.js'
import { formatDateTime, getActiveSession, setActiveSession } from '../lib/sessionMode.js'
import { exportCampaign } from '../lib/exportCampaign.js'
import QuickNoteInput from './QuickNoteInput.jsx'
import { EntityChip, SectionCard, StatusMessage } from './ui.jsx'
import './HomeHub.scss'

const QUICK_ACTIONS = [
  { type: 'npc', label: 'NPC', icon: '👤' },
  { type: 'place', label: 'Location', icon: '📍' },
  { type: 'quest', label: 'Quest', icon: '⚔️' },
  { type: 'clue', label: 'Clue', icon: '🔎' },
]

const RECENT_LIMIT = 5

function CharacterSummary({ campaignId, character }) {
  const { sheet } = useCharacterSheet(campaignId, character.id)
  const hp = sheet?.mechanics.hp
  const photo = getPublicUrl('party-portraits', character.photo_path)
  return (
    <div className="home-hub__character">
      {photo ? (
        <img src={photo} alt="" className="home-hub__portrait" />
      ) : (
        <span className="home-hub__portrait home-hub__portrait--fallback" aria-hidden="true">
          {character.name?.[0]?.toUpperCase() || '?'}
        </span>
      )}
      <div>
        <p className="home-hub__character-name">{character.name}</p>
        <p className="home-hub__character-meta">
          {[character.race_class, character.level && `Level ${character.level}`].filter(Boolean).join(' · ')}
        </p>
        {hp && hp.max !== null && hp.current !== null && (
          <p className="home-hub__character-meta mechanics">
            HP {hp.current} / {hp.max}
            {hp.temp ? ` (+${hp.temp} temp)` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

// Campaign hub: the one big action (start/resume the session), who you're
// playing, what's next, and what's still open — plus fast capture.
function HomeHub({ campaignName }) {
  const data = useCampaignData()
  const nav = useCampaignNav()
  const { campaignId, playerId, entities, loading } = data
  const { character, isAdmin } = useActiveCharacter()
  const prep = usePrep(campaignId, playerId)
  const quickNotes = useQuickNotes()
  const [active, setActive] = useState(() => getActiveSession(campaignId, playerId))
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState(null)

  function startSession() {
    if (!active) {
      const session = { startedAt: new Date().toISOString(), paused: false }
      setActiveSession(campaignId, playerId, session)
      setActive(session)
    }
    nav.goTo('session')
  }

  const sessions = entities
    .filter((e) => e.type === 'session')
    .sort(
      (a, b) =>
        sessionDateTimestamp(b.raw.session_date) - sessionDateTimestamp(a.raw.session_date) ||
        new Date(b.createdAt) - new Date(a.createdAt),
    )
  const openThreads = entities.filter((e) => e.open)
  const recentEntries = entities
    .filter((e) => !['session', 'note', 'character'].includes(e.type))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, RECENT_LIMIT)
  const nextDate = prep.doc?.nextSessionDate
  const isEmpty = !loading && entities.filter((e) => e.type !== 'character').length === 0

  async function runExport() {
    setExporting(true)
    setExportMessage(null)
    try {
      const count = await exportCampaign({ campaignId, campaignName, playerId })
      setExportMessage(`Downloaded a backup with ${count} records.`)
    } catch (err) {
      setExportMessage(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const open = (e) => nav.openEntity(e.type, e.id)

  return (
    <div className="home-hub">
      <section className="home-hub__hero panel" aria-labelledby="home-hero-title">
        <div className="home-hub__hero-text">
          <p className="home-hub__eyebrow">Campaign</p>
          <h2 id="home-hero-title" className="home-hub__campaign">
            {campaignName}
          </h2>
          <p className="home-hub__next">
            {nextDate ? (
              <>
                Next session: <strong>{formatSessionDate(nextDate)}</strong>
              </>
            ) : playerId ? (
              <button type="button" className="btn btn--text home-hub__inline-link" onClick={() => nav.goTo('prep')}>
                Set the next session date in Prep →
              </button>
            ) : null}
          </p>
        </div>
        <button type="button" className="btn btn--primary home-hub__start" onClick={startSession}>
          {active ? '▶ Resume Session' : '▶ Start Session'}
          {active && (
            <span className="home-hub__start-meta">
              {active.paused ? 'Paused' : 'In progress'} since {formatDateTime(active.startedAt)}
            </span>
          )}
        </button>
      </section>

      {isEmpty && (
        <SectionCard title="Getting started" icon="🧭" className="home-hub__onboarding">
          <ol className="home-hub__steps">
            <li>
              {character ? (
                <>You&apos;re playing <strong>{character.name}</strong>. </>
              ) : (
                <>
                  <button type="button" className="btn btn--text home-hub__inline-link" onClick={() => nav.goTo('party')}>
                    Add or claim your character
                  </button>{' '}
                  on the Party screen.{' '}
                </>
              )}
              Fill in their sheet under Character.
            </li>
            <li>Press <strong>Start Session</strong> when you sit down to play — HP, notes and initiative are all there.</li>
            <li>Jot quick notes as things happen; turn them into NPCs, places, quests or a recap afterwards.</li>
          </ol>
        </SectionCard>
      )}

      <div className="home-hub__grid">
        <SectionCard
          title={isAdmin ? 'Character' : 'Your character'}
          icon="🎭"
          action={
            <button type="button" className="btn btn--text" onClick={() => nav.goTo('character')}>
              Open sheet
            </button>
          }
        >
          {character ? (
            <CharacterSummary key={character.id} campaignId={campaignId} character={character} />
          ) : (
            <p className="inline-state">
              {isAdmin
                ? 'Pick a party member on the Character screen to view their sheet.'
                : 'You haven’t claimed a character in this campaign yet.'}{' '}
              <button type="button" className="btn btn--text home-hub__inline-link" onClick={() => nav.goTo(isAdmin ? 'character' : 'party')}>
                {isAdmin ? 'Choose one' : 'Claim one on the Party screen'}
              </button>
            </p>
          )}
        </SectionCard>

        <SectionCard title="Quick add" icon="➕">
          {quickNotes.enabled && <QuickNoteInput onAdd={quickNotes.add} />}
          <div className="home-hub__actions">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.type}
                type="button"
                className="btn home-hub__action"
                onClick={() => nav.openQuickCreate(action.type)}
              >
                <span aria-hidden="true">{action.icon}</span> {action.label}
              </button>
            ))}
            <button
              type="button"
              className="btn home-hub__action"
              onClick={() => nav.goTo('sessions', { add: true })}
            >
              <span aria-hidden="true">📖</span> Session recap
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Open threads"
          icon="🧵"
          action={
            <button type="button" className="btn btn--text" onClick={() => nav.goTo('quests')}>
              All quests
            </button>
          }
        >
          <StatusMessage loading={loading && !entities.length} empty={!openThreads.length}>
            No active quests or party goals. Add one when the story hands you a hook.
          </StatusMessage>
          {openThreads.length > 0 && (
            <ul className="home-hub__list">
              {openThreads.map((e) => (
                <li key={`${e.type}-${e.id}`}>
                  <EntityChip entity={e} onOpen={open} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent sessions"
          icon="📖"
          action={
            <button type="button" className="btn btn--text" onClick={() => nav.goTo('sessions')}>
              All sessions
            </button>
          }
        >
          <StatusMessage loading={loading && !entities.length} empty={!sessions.length}>
            No session recaps yet. End a session to turn your quick notes into one.
          </StatusMessage>
          {sessions.length > 0 && (
            <ul className="home-hub__list">
              {sessions.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <button type="button" className="home-hub__row" onClick={() => open(s)}>
                    <span className="home-hub__row-title">{s.title}</span>
                    <span className="home-hub__row-meta">{formatSessionDate(s.raw.session_date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recently added" icon="🕮">
          <StatusMessage loading={loading && !entities.length} empty={!recentEntries.length && !quickNotes.notes.length}>
            Nothing yet — NPCs, places and quests you add will show up here.
          </StatusMessage>
          {(recentEntries.length > 0 || quickNotes.notes.length > 0) && (
            <ul className="home-hub__list">
              {quickNotes.notes.slice(0, 2).map((n) => (
                <li key={n.id}>
                  <button type="button" className="home-hub__row" onClick={() => nav.openEntity('note', n.id)}>
                    <span className="home-hub__row-title">✏️ {n.content}</span>
                    <span className="home-hub__row-meta">{formatDateTime(n.createdAt)}</span>
                  </button>
                </li>
              ))}
              {recentEntries.map((e) => (
                <li key={`${e.type}-${e.id}`}>
                  <EntityChip entity={e} onOpen={open} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <footer className="home-hub__footer">
        <button type="button" className="btn btn--text" onClick={runExport} disabled={exporting}>
          {exporting ? 'Preparing backup…' : '⬇ Export campaign backup (JSON)'}
        </button>
        {exportMessage && (
          <p className="field-hint" role="status">
            {exportMessage}
          </p>
        )}
      </footer>
    </div>
  )
}

export default HomeHub
