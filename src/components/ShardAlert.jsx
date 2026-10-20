import { useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import Icon from './Icon.jsx'
import './ShardAlert.scss'

const SHOW_MS = 4000
const SPARKS = 10

const fromRow = (r) => ({ id: r.id, shards: r.shards })

// When the DM gives or takes a player's shards (on any device), that
// player sees it: gained shards burst out of a glowing gem, lost ones
// crack and fall away. The count seen when the campaign opens is just
// remembered, so nothing replays.
function ShardAlert({ campaignId, playerId }) {
  const { items, loading } = useSupabaseTable('player_shards', {
    fromRow,
    filters: { campaign_id: campaignId, player_id: playerId },
  })
  const known = useRef(null)
  const [queue, setQueue] = useState([])

  useEffect(() => {
    if (loading) return
    const total = items[0]?.shards ?? 0
    if (known.current !== null && total !== known.current) {
      const delta = total - known.current
      setQueue((q) => [...q, { key: `${Date.now()}:${total}`, delta, total }])
    }
    known.current = total
  }, [items, loading])

  const current = queue[0]
  useEffect(() => {
    if (!current) return undefined
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS)
    return () => clearTimeout(timer)
  }, [current])

  if (!current) return null
  const gain = current.delta > 0
  const n = Math.abs(current.delta)
  const shards = `${n} shard${n === 1 ? '' : 's'}`

  return (
    <button
      type="button"
      key={current.key}
      className={`shard-alert shard-alert--${gain ? 'gain' : 'loss'}`}
      onClick={() => setQueue((q) => q.slice(1))}
      role="status"
      aria-label={`${gain ? `Your DM gave you ${shards}` : `Your DM took ${shards}`}. You now have ${current.total}.`}
    >
      <span className="shard-alert__gem" aria-hidden="true">
        <Icon name="gem" size="2.2rem" />
        <span className="shard-alert__sparks">
          {Array.from({ length: SPARKS }, (_, i) => (
            <span key={i} style={{ '--i': i }} />
          ))}
        </span>
      </span>
      <span className="shard-alert__text" aria-hidden="true">
        <strong className="shard-alert__delta">
          {gain ? '+' : '−'}
          {n}
        </strong>
        <span className="shard-alert__line">{gain ? `Your DM gave you ${shards}` : `Your DM took ${shards}`}</span>
        <span className="shard-alert__total">
          You now have <Icon name="gem" /> {current.total}
        </span>
      </span>
    </button>
  )
}

export default ShardAlert
