import { useEffect, useMemo, useRef, useState } from 'react'
import { useDmShares } from '../hooks/useDmShares.js'
import { SHARE_KINDS, addShareToParty, shareDetail, shareImage, shareLabel } from '../lib/dmShares.js'
import { getStored, setStored } from '../lib/sessionMode.js'
import Icon from './Icon.jsx'
import './RevealOverlay.scss'

// Only reveals from the last few minutes pop up, so opening the app later
// doesn't replay old ones (they're still in the bell).
const REVEAL_WINDOW_MS = 5 * 60 * 1000
const SEEN_LIMIT = 50

// "some art", "a map", "an NPC", "a monster".
function revealNoun(share) {
  if (share.kind === 'art') return 'some art'
  const label = share.kind === 'npc' ? 'NPC' : shareLabel(share).toLowerCase()
  return `${/^[aeiou]|^NPC/i.test(label) ? 'an' : 'a'} ${label}`
}

const SPARKS = 12

// When the DM presses "Reveal now", the NPC, monster, art or map fills the
// screen of every player who has the campaign open — like sliding a
// handout across the table. It arrives sealed: a wax seal drops in and
// cracks, sparks fly, and the handout unrolls like a scroll. Each reveal
// shows once per device.
function RevealOverlay({ campaignId }) {
  const { shares } = useDmShares(campaignId)
  const seenKey = `dnd-notes-reveals-seen:${campaignId}`
  const [seen, setSeen] = useState(() => new Set(getStored(seenKey, [])))
  const [result, setResult] = useState(null)
  const [adding, setAdding] = useState(false)
  const closeRef = useRef(null)

  const reveal = useMemo(() => {
    const now = Date.now()
    return (
      shares.find(
        (s) => s.payload?.reveal && !seen.has(s.id) && now - new Date(s.createdAt).getTime() < REVEAL_WINDOW_MS,
      ) || null
    )
  }, [shares, seen])

  function close() {
    if (!reveal) return
    const next = new Set(seen)
    next.add(reveal.id)
    setSeen(next)
    setStored(seenKey, [...next].slice(-SEEN_LIMIT))
    setResult(null)
  }
  const closeLatest = useRef(close)
  closeLatest.current = close

  useEffect(() => {
    if (!reveal) return undefined
    closeRef.current?.focus()
    function onKey(event) {
      if (event.key === 'Escape') closeLatest.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [reveal])

  if (!reveal) return null

  const kind = SHARE_KINDS[reveal.kind]
  const image = shareImage(reveal)
  const detail = shareDetail(reveal)
  const description = ['npc', 'creature'].includes(reveal.kind) ? reveal.payload.description : reveal.payload.notes

  async function add() {
    setAdding(true)
    try {
      const outcome = await addShareToParty(reveal, campaignId)
      setResult(
        outcome === 'added'
          ? `Added to ${kind.tabLabel}.`
          : outcome === 'already'
            ? `Already in ${kind.tabLabel}.`
            : 'Your DM has removed this.',
      )
    } catch (err) {
      setResult(`Couldn’t add it: ${err.message}`)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      className={`reveal reveal--${reveal.kind}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-title"
      onClick={close}
      key={reveal.id}
    >
      <div className="reveal__glow" aria-hidden="true" />
      <div className="reveal__seal" aria-hidden="true">
        <span className="reveal__seal-half reveal__seal-half--left">
          <Icon name={kind.icon} />
        </span>
        <span className="reveal__seal-half reveal__seal-half--right">
          <Icon name={kind.icon} />
        </span>
      </div>
      <div className="reveal__sparks" aria-hidden="true">
        {Array.from({ length: SPARKS }, (_, i) => (
          <span key={i} style={{ '--i': i }} />
        ))}
      </div>
      <div className="reveal__scroll" onClick={(e) => e.stopPropagation()}>
        <span className="reveal__roller reveal__roller--top" aria-hidden="true" />
        <span className="reveal__roller reveal__roller--bottom" aria-hidden="true" />
        <div className={`reveal__card reveal__card--${reveal.kind}`}>
          <p className="reveal__eyebrow">
            <Icon name="eye" /> Your DM reveals {revealNoun(reveal)}
          </p>
          {image ? (
            <img className="reveal__image" src={image} alt={reveal.title || ''} />
          ) : (
            <div className="reveal__placeholder" aria-hidden="true">
              {reveal.kind === 'npc' ? (reveal.title || '?').charAt(0).toUpperCase() : <Icon name={kind.icon} />}
            </div>
          )}
          <h2 id="reveal-title" className="reveal__title">
            {reveal.title || 'Untitled'}
          </h2>
          {detail && <p className="reveal__detail">{detail}</p>}
          {description && <p className="reveal__description">{description}</p>}
          {result && (
            <p className="reveal__result" role="status">
              {result}
            </p>
          )}
          <div className="reveal__actions">
            {!result && (
              <button type="button" className="btn btn--primary" onClick={add} disabled={adding}>
                {adding ? 'Adding…' : `+ Add to ${kind.tabLabel}`}
              </button>
            )}
            <button type="button" className="btn" onClick={close} ref={closeRef}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RevealOverlay
