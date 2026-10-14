import { useEffect, useRef, useState } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { getPublicUrl } from '../../lib/storage.js'
import './LevelUp.scss'

const SHOW_MS = 4200
const RAYS = 12

// When a party member's level goes up (on any device), everyone in the
// campaign sees it: the player whose character it is gets a full-screen
// burst of light; everyone else gets a banner. Levels seen when the
// campaign opens are just remembered, so nothing replays.
function LevelUp() {
  const { playerId, tables } = useCampaignData()
  const { items, loading } = tables.character
  const known = useRef(null)
  const [queue, setQueue] = useState([])

  useEffect(() => {
    if (loading) return
    const levels = new Map(items.map((m) => [m.id, Number(m.level) || 0]))
    if (known.current) {
      const ups = items
        .filter((m) => m.member_type !== 'NPC' && known.current.has(m.id))
        .filter((m) => (Number(m.level) || 0) > known.current.get(m.id) && known.current.get(m.id) > 0)
        .map((m) => ({
          key: `${m.id}:${m.level}`,
          name: m.name || 'Someone',
          level: Number(m.level),
          mine: Boolean(playerId) && m.claimed_by === playerId,
          photo: getPublicUrl('party-portraits', m.photo_path),
        }))
      if (ups.length) setQueue((q) => [...q, ...ups])
    }
    known.current = levels
  }, [items, loading, playerId])

  const current = queue[0]
  useEffect(() => {
    if (!current) return undefined
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS)
    return () => clearTimeout(timer)
  }, [current])

  if (!current) return null
  const dismiss = () => setQueue((q) => q.slice(1))

  if (!current.mine) {
    return (
      <button type="button" className="level-up-banner" key={current.key} onClick={dismiss} role="status">
        <span className="level-up-banner__star" aria-hidden="true">
          ✦
        </span>
        <span>
          <strong>{current.name}</strong> reached <strong>Level {current.level}</strong>!
        </span>
      </button>
    )
  }

  return (
    <div className="level-up" key={current.key} onClick={dismiss} role="status">
      <div className="level-up__rays" aria-hidden="true">
        {Array.from({ length: RAYS }, (_, i) => (
          <span key={i} style={{ '--i': i }} />
        ))}
      </div>
      <div className="level-up__card">
        {current.photo ? (
          <img className="level-up__portrait" src={current.photo} alt="" />
        ) : (
          <span className="level-up__portrait level-up__portrait--initial" aria-hidden="true">
            {current.name.charAt(0).toUpperCase()}
          </span>
        )}
        <p className="level-up__eyebrow">Level up!</p>
        <p className="level-up__level">Level {current.level}</p>
        <p className="level-up__name">{current.name} grows stronger.</p>
        <p className="level-up__hint">Tap to continue</p>
      </div>
    </div>
  )
}

export default LevelUp
