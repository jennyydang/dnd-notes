import { useEffect, useMemo, useRef, useState } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { extractMentions, notesToPlainText } from '../../lib/richNotes.js'
import { formatSessionDate } from '../../lib/sessionNotes.js'
import { buildPreviously, sortedSessions } from '../../lib/previously.js'
import { getPublicUrl } from '../../lib/storage.js'
import Icon from '../Icon.jsx'
import PainBadge from '../PainBadge.jsx'
import { usePartyHealth } from '../../hooks/usePartyHealth.js'
import { painLabel, regionLabel } from '../../lib/injuries.js'
import './PreviouslyOn.scss'
import { lockScroll } from '../../lib/scrollLock.js'

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

// "Previously on <campaign>…": a parchment card to read aloud as the
// session starts — the opening of last session's recap, who and where it
// involved, and what's still unresolved. `onBegin` (optional) adds a
// "Begin session" button; closing never starts anything.
function PreviouslyOn({ campaignName, onClose, onBegin }) {
  const { entities } = useCampaignData()
  const hurting = usePartyHealth().health.filter((h) => h.injuries.length > 0)
  const [speaking, setSpeaking] = useState(false)
  const beginRef = useRef(null)

  const card = useMemo(() => {
    const sessions = sortedSessions(entities)
    const notes = sessions[0]?.raw.notes || ''
    return buildPreviously({
      sessions,
      recapText: notesToPlainText(notes),
      mentions: extractMentions(notes),
      npcs: entities.filter((e) => e.type === 'npc'),
      threads: entities.filter((e) => e.open),
      loot: entities.filter((e) => e.type === 'loot'),
    })
  }, [entities])

  const overlayRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    // Focus Begin for the keyboard, but open at the top of the recap
    // (focusing scrolled the overlay down to the button).
    beginRef.current?.focus({ preventScroll: true })
    if (overlayRef.current) overlayRef.current.scrollTop = 0
    const unlock = lockScroll()
    function onKey(event) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlock()
      if (canSpeak()) window.speechSynthesis.cancel()
    }
  }, [])

  function readAloud() {
    if (!canSpeak()) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const parts = [
      `Previously, on ${campaignName}.`,
      ...card.recap,
      card.loot.length ? `You came away with ${card.loot.map((l) => l.title).join(', ')}.` : '',
      card.threads.length ? `Still unresolved: ${card.threads.map((t) => t.title).join(', ')}.` : '',
      hurting.length
        ? `Still hurting: ${hurting
            .map((h) => `${h.member.name}'s ${h.injuries.map((i) => `${regionLabel(i.region).toLowerCase()}, ${painLabel(i.pain).toLowerCase()}`).join(' and ')}`)
            .join('; ')}.`
        : '',
    ]
    const utterance = new SpeechSynthesisUtterance(parts.filter(Boolean).join(' '))
    utterance.rate = 0.95
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  const lastTitle = card.last?.title && card.last.title !== 'Untitled Session' ? card.last.title : null

  return (
    <div ref={overlayRef} className="previously" role="dialog" aria-modal="true" aria-labelledby="previously-title" onClick={onClose}>
      <article className="previously__card" onClick={(e) => e.stopPropagation()}>
        <p className="previously__eyebrow">Previously on</p>
        <h2 id="previously-title" className="previously__title">
          {campaignName}
        </h2>
        {card.last && (
          <p className="previously__session">
            {lastTitle || `Session ${card.number}`}
            {card.last.raw.session_date ? ` · ${formatSessionDate(card.last.raw.session_date)}` : ''}
          </p>
        )}
        <div className="previously__rule" aria-hidden="true" />

        {card.recap.length > 0 ? (
          <div className="previously__recap">
            {card.recap.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="previously__recap previously__recap--empty">
            {card.last
              ? 'Last session has no recap yet — tell the table what happened in your own words.'
              : 'Your first session. Every legend starts somewhere.'}
          </p>
        )}

        {card.threads.length > 0 && (
          <section className="previously__section">
            <h3>Still unresolved</h3>
            <ul className="previously__threads">
              {card.threads.map((t) => (
                <li key={`${t.type}:${t.id}`}>
                  <Icon name={t.type === 'goal' ? 'target' : 'quest'} /> {t.title}
                </li>
              ))}
            </ul>
          </section>
        )}

        {card.loot.length > 0 && (
          <section className="previously__section">
            <h3>Loot found</h3>
            <ul className="previously__chips">
              {card.loot.map((l) => {
                const photo = l.raw?.photo_path ? getPublicUrl('loot-photos', l.raw.photo_path) : ''
                return (
                  <li key={l.id} className="previously__chip previously__chip--loot">
                    {photo ? <img src={photo} alt="" /> : <Icon name="coins" />}
                    {l.title}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {hurting.length > 0 && (
          <section className="previously__section">
            <h3>Still hurting</h3>
            <ul className="previously__hurt">
              {hurting.map((h) => (
                <li key={h.member.id}>
                  <strong>{h.member.name}</strong>
                  <span className="previously__badges">
                    {h.injuries.map((i) => (
                      <PainBadge key={i.region} injury={i} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(card.faces.length > 0 || card.places.length > 0) && (
          <section className="previously__section">
            <h3>{card.facesAreTagged ? 'Who and where' : 'Faces you’ve met'}</h3>
            <ul className="previously__chips">
              {card.faces.map((f) => {
                const photo = f.raw?.photo_path ? getPublicUrl('npc-portraits', f.raw.photo_path) : ''
                return (
                  <li key={f.id} className="previously__chip">
                    {photo ? <img src={photo} alt="" /> : <span aria-hidden="true">{(f.title || '?').charAt(0)}</span>}
                    {f.title}
                  </li>
                )
              })}
              {card.places.map((p) => (
                <li key={p} className="previously__chip previously__chip--place">
                  <Icon name="pin" /> {p}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="previously__actions">
          {canSpeak() && (card.recap.length > 0 || card.loot.length > 0 || hurting.length > 0) && (
            <button type="button" className="btn btn--text previously__speak" onClick={readAloud} aria-pressed={speaking}>
              <Icon name={speaking ? 'pause' : 'speech'} /> {speaking ? 'Stop reading' : 'Read it aloud'}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {onBegin ? 'Not yet' : 'Close'}
          </button>
          {onBegin && (
            <button type="button" className="btn btn--primary" onClick={onBegin} ref={beginRef}>
              <Icon name="play" /> Begin session
            </button>
          )}
        </div>
      </article>
    </div>
  )
}

export default PreviouslyOn
