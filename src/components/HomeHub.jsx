import { Children, useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { useActiveCharacter } from '../hooks/useActiveCharacter.js'
import { useCharacterSheet } from '../hooks/useCharacterSheet.js'
import { usePrep } from '../hooks/usePrep.js'
import { useQuickNotes } from '../hooks/useQuickNotes.js'
import { OPEN_DM_INBOX, useDmInbox } from '../hooks/useDmInbox.js'
import { getPublicUrl } from '../lib/storage.js'
import { formatSessionDate, sessionDateTimestamp } from '../lib/sessionNotes.js'
import { formatDateTime, getActiveSession, setActiveSession } from '../lib/sessionMode.js'
import { exportCampaign } from '../lib/exportCampaign.js'
import QuickNoteInput from './QuickNoteInput.jsx'
import { SectionCard, StatusMessage } from './ui.jsx'
import Icon from './Icon.jsx'
import './HomeHub.scss'

const QUICK_ACTIONS = [
  { type: 'npc', label: 'NPC', icon: 'user' },
  { type: 'place', label: 'Location', icon: 'pin' },
  { type: 'quest', label: 'Quest', icon: 'quest' },
  { type: 'clue', label: 'Clue', icon: 'search' },
]

const RECENT_LIMIT = 5
const THREAD_LIMIT = 5
const EARLIER_LIMIT = 2
const NO_PLAYER = '00000000-0000-0000-0000-000000000000'

// A plain vertical list of MiniCards (children keep their own keys).
function CardList({ label, children }) {
  return (
    <ul className="home-hub__cards" aria-label={label}>
      {Children.toArray(children).map((child) => (
        <li key={child.key}>{child}</li>
      ))}
    </ul>
  )
}

// One compact card in a Home list.
function MiniCard({ icon, type, title, meta, onClick }) {
  return (
    <button type="button" className="mini-card" onClick={onClick}>
      <span className="mini-card__type">
        <Icon name={icon} /> {type}
      </span>
      <span className="mini-card__title">{title || 'Untitled'}</span>
      {meta && <span className="mini-card__meta">{meta}</span>}
    </button>
  )
}

function CharacterSummary({ campaignId, character }) {
  const { sheet } = useCharacterSheet(campaignId, character.id)
  const hp = sheet?.mechanics.hp
  const ac = sheet?.mechanics.ac
  const hasHp = hp && hp.max !== null && hp.current !== null && hp.max > 0
  const hpPct = hasHp ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 0
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
      <div className="home-hub__character-info">
        <p className="home-hub__character-name">{character.name}</p>
        <p className="home-hub__character-meta">
          {[character.race_class, character.level && `Level ${character.level}`].filter(Boolean).join(' · ')}
        </p>
        {(hasHp || ac != null) && (
          <div className="home-hub__vitals">
            {hasHp && (
              <div className="home-hub__hp">
                <span className="home-hub__hp-text mechanics">
                  HP {hp.current} / {hp.max}
                  {hp.temp ? ` (+${hp.temp})` : ''}
                </span>
                <span
                  className={`home-hub__hp-bar${hpPct <= 25 ? ' home-hub__hp-bar--low' : ''}`}
                  role="meter"
                  aria-label="Hit points"
                  aria-valuemin={0}
                  aria-valuemax={hp.max}
                  aria-valuenow={hp.current}
                >
                  <span style={{ width: `${hpPct}%` }} />
                </span>
              </div>
            )}
            {ac != null && (
              <span className="home-hub__ac mechanics" title="Armor Class">
                <Icon name="shield" /> AC {ac}
              </span>
            )}
          </div>
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
  const [lastSession, ...olderSessions] = sessions
  const earlierSessions = olderSessions.slice(0, EARLIER_LIMIT)
  const openThreads = entities.filter((e) => e.open)
  // Same inbox as the top-bar bell; the admin (no player) never has one.
  const dmInbox = useDmInbox(campaignId, playerId || NO_PLAYER)
  const dmNews = playerId && !nav.isDm && !dmInbox.error ? dmInbox.inbox : []
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
      const count = await exportCampaign({ campaignId, campaignName, playerId, includeDm: nav.isDm })
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
          <span>
            <Icon name="play" /> {active ? 'Resume Session' : 'Start Session'}
          </span>
          {active && (
            <span className="home-hub__start-meta">
              {active.paused ? 'Paused' : 'In progress'} since {formatDateTime(active.startedAt)}
            </span>
          )}
        </button>
      </section>

      {dmNews.length > 0 && (
        <button
          type="button"
          className="home-hub__dm-news panel"
          onClick={() => window.dispatchEvent(new Event(OPEN_DM_INBOX))}
        >
          <span className="home-hub__dm-news-icon" aria-hidden="true">
            <Icon name="bell" />
          </span>
          <span className="home-hub__dm-news-text">
            <strong>
              Your DM shared {dmNews.length} new {dmNews.length === 1 ? 'thing' : 'things'}
            </strong>
            <span>{dmNews.slice(0, 3).map((share) => share.title || 'Untitled').join(' · ')}</span>
          </span>
          <span className="home-hub__dm-news-cta">View →</span>
        </button>
      )}

      {isEmpty && (
        <SectionCard title="Getting started" icon="compass" className="home-hub__onboarding">
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

      <div className="home-hub__layout">
        <SectionCard
          title={isAdmin ? 'Character' : 'Your character'}
          icon="character"
          className="home-hub__area home-hub__area--character"
        >
          {character ? (
            <>
              <CharacterSummary key={character.id} campaignId={campaignId} character={character} />
              <div className="home-hub__links">
                <button type="button" className="btn home-hub__link" onClick={() => nav.goTo('character')}>
                  <Icon name="scroll" /> Sheet
                </button>
                <button type="button" className="btn home-hub__link" onClick={() => nav.goTo('spells')}>
                  <Icon name="spell" /> Spells
                </button>
                <button type="button" className="btn home-hub__link" onClick={() => nav.goTo('party')}>
                  <Icon name="shield" /> Party
                </button>
              </div>
            </>
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

        <SectionCard title="Quick add" icon="plus" className="home-hub__area home-hub__area--quick">
          {quickNotes.enabled && <QuickNoteInput onAdd={quickNotes.add} />}
          <div className="home-hub__actions">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.type}
                type="button"
                className="btn home-hub__action"
                onClick={() => nav.openQuickCreate(action.type)}
              >
                <Icon name={action.icon} /> {action.label}
              </button>
            ))}
            <button
              type="button"
              className="btn home-hub__action"
              onClick={() => nav.goTo('sessions', { add: true })}
            >
              <Icon name="book" /> Session recap
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Last session"
          icon="book"
          className="home-hub__area home-hub__area--last"
          action={
            sessions.length > 0 && (
              <button type="button" className="btn btn--text" onClick={() => nav.goTo('sessions')}>
                All sessions
              </button>
            )
          }
        >
          <StatusMessage loading={loading && !entities.length} empty={!lastSession}>
            No session recaps yet. End a session to turn your quick notes into one.
          </StatusMessage>
          {lastSession && (
            <button type="button" className="home-hub__recap" onClick={() => open(lastSession)}>
              <span className="home-hub__recap-title">{lastSession.title || 'Untitled Session'}</span>
              {lastSession.raw.session_date && (
                <span className="home-hub__recap-date">{formatSessionDate(lastSession.raw.session_date)}</span>
              )}
              {lastSession.body && <span className="home-hub__recap-body">{lastSession.body}</span>}
              <span className="home-hub__recap-more">Read the recap →</span>
            </button>
          )}
          {earlierSessions.length > 0 && (
            <div className="home-hub__earlier">
              <span className="home-hub__earlier-label">Earlier</span>
              {earlierSessions.map((sess) => (
                <button key={sess.id} type="button" className="btn btn--text home-hub__earlier-link" onClick={() => open(sess)}>
                  {sess.title || 'Untitled Session'}
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Open threads"
          icon="threads"
          className="home-hub__area home-hub__area--threads"
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
            <CardList label="Open threads">
              {openThreads.slice(0, THREAD_LIMIT).map((e) => (
                <MiniCard
                  key={`${e.type}-${e.id}`}
                  icon={e.icon}
                  type={e.label}
                  title={e.title}
                  meta={e.raw.given_by ? `From ${e.raw.given_by}` : e.body}
                  onClick={() => open(e)}
                />
              ))}
            </CardList>
          )}
          {openThreads.length > THREAD_LIMIT && (
            <p className="field-hint">+ {openThreads.length - THREAD_LIMIT} more in Quests</p>
          )}
        </SectionCard>

        <SectionCard title="Recently added" icon="library" className="home-hub__area home-hub__area--recent">
          <StatusMessage loading={loading && !entities.length} empty={!recentEntries.length && !quickNotes.notes.length}>
            Nothing yet — NPCs, places and quests you add will show up here.
          </StatusMessage>
          {(recentEntries.length > 0 || quickNotes.notes.length > 0) && (
            <ul className="home-hub__recent" aria-label="Recently added">
              {[
                ...quickNotes.notes.slice(0, 2).map((n) => (
                  <li key={`note-${n.id}`}>
                    <MiniCard
                      icon="edit"
                      type="Quick note"
                      title={n.content}
                      meta={formatDateTime(n.createdAt)}
                      onClick={() => nav.openEntity('note', n.id)}
                    />
                  </li>
                )),
                ...recentEntries.map((e) => (
                  <li key={`${e.type}-${e.id}`}>
                    <MiniCard
                      icon={e.icon}
                      type={e.label}
                      title={e.title}
                      meta={e.subtitle || e.body}
                      onClick={() => open(e)}
                    />
                  </li>
                )),
              ]}
            </ul>
          )}
        </SectionCard>
      </div>

      <footer className="home-hub__footer">
        <button type="button" className="btn btn--text" onClick={runExport} disabled={exporting}>
          {exporting ? 'Preparing backup…' : (
            <>
              <Icon name="download" /> Export campaign backup (JSON)
            </>
          )}
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
