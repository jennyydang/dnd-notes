import { useEffect, useMemo, useRef, useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { usePolls } from '../hooks/usePolls.js'
import { useEdgeFades } from '../hooks/useEdgeFades.js'
import { buildReel } from '../lib/highlights.js'
import { formatDuration } from '../lib/sessionRecorder.js'
import { TAG_GROUPS } from '../lib/tags.js'
import { AUDIO_SEEK_EVENT } from './SessionAudio.jsx'
import Icon from './Icon.jsx'
import './SessionReel.scss'

const STEP_MS = 2200
const KIND_ICON = { mark: 'bookmark', vote: 'vote', quest: 'quest' }
const ENTITY_TYPE = { person: 'npc', place: 'place', lore: 'lore', loot: 'loot', creature: 'creature', quest: 'quest' }

// A session at a glance: who they met, where they went, what they found
// and faced (in the order the recap tells it), the recording's bookmarks,
// and what was decided and finished that day. "Play" walks through it.
function SessionReel({ session }) {
  const { tables } = useCampaignData()
  const nav = useCampaignNav()
  const polls = usePolls()
  const reel = useMemo(
    () =>
      buildReel({
        notes: session.notes,
        sessionDate: session.sessionDate,
        marks: session.audioPath ? session.audioMarks : [],
        polls: polls.polls,
        quests: tables.quest.items,
      }),
    [session, polls.polls, tables.quest.items],
  )
  const [playing, setPlaying] = useState(-1)
  const listRef = useRef(null)
  const [fadeRef, fadeClass] = useEdgeFades()

  useEffect(() => {
    if (playing < 0) return undefined
    listRef.current?.children[playing]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    const timer = setTimeout(() => setPlaying((i) => (i + 1 < reel.length ? i + 1 : -1)), STEP_MS)
    return () => clearTimeout(timer)
  }, [playing, reel.length])

  // A different session starts fresh.
  useEffect(() => setPlaying(-1), [session.id])

  if (reel.length === 0) return null

  function open(moment) {
    if (moment.kind === 'mark') {
      window.dispatchEvent(new CustomEvent(AUDIO_SEEK_EVENT, { detail: { sessionId: session.id, t: moment.t } }))
      return
    }
    const type = ENTITY_TYPE[moment.kind]
    if (type && moment.id) nav.openEntity(type, moment.id)
  }

  const clickable = (m) => m.kind === 'mark' || (ENTITY_TYPE[m.kind] && m.id)

  return (
    <section className="session-reel panel" aria-label="Highlight reel">
      <header className="session-reel__head">
        <h4 className="session-reel__title">
          <Icon name="spell" /> Highlight reel
          <span className="session-reel__count">{reel.length} moments</span>
        </h4>
        <button
          type="button"
          className="btn session-reel__play"
          onClick={() => setPlaying((i) => (i >= 0 ? -1 : 0))}
          aria-pressed={playing >= 0}
        >
          <Icon name={playing >= 0 ? 'pause' : 'play'} /> {playing >= 0 ? 'Pause' : 'Play'}
        </button>
      </header>
      <ol
        ref={(el) => {
          listRef.current = el
          fadeRef(el)
        }}
        className={`session-reel__list ${fadeClass}`}
      >
        {reel.map((m, i) => {
          const icon = KIND_ICON[m.kind] || TAG_GROUPS[m.kind]?.icon || 'star'
          const Tag = clickable(m) ? 'button' : 'div'
          return (
            <li key={m.key} className={`session-reel__item${i === playing ? ' is-playing' : ''}${i < playing ? ' is-past' : ''}`}>
              <Tag
                {...(Tag === 'button' ? { type: 'button', onClick: () => open(m) } : {})}
                className={`session-reel__tile session-reel__tile--${m.kind}`}
                title={m.kind === 'mark' ? 'Play the recording from here' : undefined}
              >
                <span className="session-reel__icon" aria-hidden="true">
                  <Icon name={icon} />
                </span>
                <span className="session-reel__verb">
                  {m.verb}
                  {m.kind === 'mark' && <span className="session-reel__time">{formatDuration(m.t)}</span>}
                </span>
                <strong className="session-reel__label">{m.label}</strong>
                {m.context && <span className="session-reel__context">{m.context}</span>}
              </Tag>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default SessionReel
