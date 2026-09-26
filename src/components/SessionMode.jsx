import { useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { useActiveCharacter } from '../hooks/useActiveCharacter.js'
import { useCharacterSheet } from '../hooks/useCharacterSheet.js'
import { useQuickNotes } from '../hooks/useQuickNotes.js'
import { initiativeBonus } from '../lib/character.js'
import { formatDateTime, getActiveSession, setActiveSession } from '../lib/sessionMode.js'
import TabNav from './TabNav.jsx'
import VitalsPanel from './session/VitalsPanel.jsx'
import QuickNotesPanel from './session/QuickNotesPanel.jsx'
import InitiativeTracker from './session/InitiativeTracker.jsx'
import ReferencePanel from './session/ReferencePanel.jsx'
import EndSessionModal from './session/EndSessionModal.jsx'
import CharacterPicker from './character/CharacterPicker.jsx'
import { SectionCard } from './ui.jsx'
import './SessionMode.scss'

const PANELS = [
  { id: 'vitals', label: 'Character' },
  { id: 'notes', label: 'Notes' },
  { id: 'initiative', label: 'Initiative' },
  { id: 'reference', label: 'Reference' },
]

const QUICK_ADD = [
  { type: 'npc', label: 'NPC', icon: '👤' },
  { type: 'place', label: 'Place', icon: '📍' },
  { type: 'quest', label: 'Quest', icon: '⚔️' },
  { type: 'clue', label: 'Clue', icon: '🔎' },
]

// Needs the sheet, so it only renders once a character is chosen; keyed
// by character so switching characters starts a fresh autosave.
function CharacterPanels({ campaignId, character, nav, panelClass }) {
  const sheetApi = useCharacterSheet(campaignId, character.id)
  return (
    <>
      <div className={panelClass('vitals')}>
        <VitalsPanel character={character} sheetApi={sheetApi} onEditSheet={() => nav.goTo('character')} />
      </div>
      <div className={panelClass('initiative')}>
        <InitiativeTracker
          campaignId={campaignId}
          characterName={character.name}
          characterInitBonus={sheetApi.sheet ? initiativeBonus(sheetApi.sheet.mechanics) : null}
        />
      </div>
      <div className={panelClass('reference')}>
        {sheetApi.sheet && (
          <ReferencePanel
            character={character}
            sheet={sheetApi.sheet}
            onEditSheet={() => nav.goTo('character')}
            onEditRoleplay={() => nav.goTo('character')}
          />
        )}
      </div>
    </>
  )
}

// Low-distraction live-game screen. On phones one panel shows at a time
// (switcher at the top, big touch targets); wider screens show them all
// side by side. Nothing here requires leaving the screen to record a note.
function SessionMode() {
  const { campaignId, playerId } = useCampaignData()
  const nav = useCampaignNav()
  const { character, party, isAdmin, pick, loading } = useActiveCharacter()
  const quickNotes = useQuickNotes()
  const [active, setActive] = useState(() => getActiveSession(campaignId, playerId))
  const [panel, setPanel] = useState('vitals')
  const [ending, setEnding] = useState(false)
  const [endedMessage, setEndedMessage] = useState(null)

  function save(next) {
    setActiveSession(campaignId, playerId, next)
    setActive(next)
  }

  const sessionNotes = active
    ? quickNotes.notes.filter((n) => !n.sessionNoteId && new Date(n.createdAt) >= new Date(active.startedAt))
    : []

  const panelClass = (id) => `session-mode__panel session-mode__panel--${id}${panel === id ? ' session-mode__panel--active' : ''}`

  return (
    <div className="session-mode">
      <div className={`session-mode__status panel${active ? '' : ' session-mode__status--idle'}`}>
        {active ? (
          <>
            <p className="session-mode__state" role="status">
              <span className={`session-mode__dot${active.paused ? ' session-mode__dot--paused' : ''}`} aria-hidden="true" />
              {active.paused ? 'Paused' : 'Session in progress'} · since {formatDateTime(active.startedAt)}
            </p>
            <div className="session-mode__status-actions">
              <button type="button" className="btn" onClick={() => save({ ...active, paused: !active.paused })}>
                {active.paused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setEnding(true)}>
                ■ End session
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="session-mode__state">No session running.</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setEndedMessage(null)
                save({ startedAt: new Date().toISOString(), paused: false })
              }}
            >
              ▶ Start session
            </button>
          </>
        )}
      </div>
      {endedMessage && (
        <p className="session-mode__ended" role="status">
          {endedMessage}
        </p>
      )}

      <div className="session-mode__quick-add" role="group" aria-label="Quick add">
        {QUICK_ADD.map((a) => (
          <button key={a.type} type="button" className="btn" onClick={() => nav.openQuickCreate(a.type)}>
            <span aria-hidden="true">{a.icon}</span> {a.label}
          </button>
        ))}
      </div>

      <TabNav tabs={PANELS} activeTab={panel} onSelect={setPanel} className="tab-nav--pill session-mode__switcher" label="Session panels" />

      {isAdmin && (
        <CharacterPicker party={party} value={character?.id || ''} onChange={pick} />
      )}

      <div className="session-mode__grid">
        {character ? (
          <CharacterPanels key={character.id} campaignId={campaignId} character={character} nav={nav} panelClass={panelClass} />
        ) : (
          <div className={panelClass('vitals')}>
            <SectionCard title="Character" icon="❤️">
              <p className="inline-state">
                {loading
                  ? 'Loading…'
                  : isAdmin
                    ? 'Choose a party member above to track their HP and resources.'
                    : 'Claim your character on the Party screen to track HP, slots and conditions here.'}
              </p>
              {!loading && !isAdmin && (
                <button type="button" className="btn" onClick={() => nav.goTo('party')}>
                  Go to Party
                </button>
              )}
            </SectionCard>
          </div>
        )}
        <div className={panelClass('notes')}>
          <QuickNotesPanel quickNotes={quickNotes} since={active?.startedAt} />
        </div>
        {!character && (
          <>
            <div className={panelClass('initiative')}>
              <InitiativeTracker campaignId={campaignId} />
            </div>
            <div className={panelClass('reference')}>
              <SectionCard title="Reference" icon="📚">
                <p className="inline-state">Pick a character to see their spells, inventory and skills.</p>
              </SectionCard>
            </div>
          </>
        )}
      </div>

      {ending && (
        <EndSessionModal
          notes={sessionNotes}
          onClose={() => setEnding(false)}
          onEnded={(created) => {
            save(null)
            setEnding(false)
            setEndedMessage(
              created
                ? 'Session ended and recap saved to Session Notes.'
                : 'Session ended. Your quick notes are still saved.',
            )
          }}
        />
      )}
    </div>
  )
}

export default SessionMode
