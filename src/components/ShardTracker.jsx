import { useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { listCampaignPlayers } from '../lib/campaigns.js'
import Icon from './Icon.jsx'

const fromRow = (r) => ({ id: r.id, playerId: r.player_id, shards: r.shards })
const plural = (n) => `${n} shard${n === 1 ? '' : 's'}`

// Shards are the DM's to hand out. The DM (or the admin, with no playerId)
// gives and takes them per player; a player just sees their own count —
// and gets a ShardAlert whenever the DM changes it.
function ShardTracker({ campaignId, playerId, manage = false }) {
  return manage || !playerId ? (
    <DmShards campaignId={campaignId} playerId={playerId} />
  ) : (
    <MyShards campaignId={campaignId} playerId={playerId} />
  )
}

function MyShards({ campaignId, playerId }) {
  const { items, loading, error } = useSupabaseTable('player_shards', {
    fromRow,
    filters: { campaign_id: campaignId, player_id: playerId },
  })
  const count = items[0]?.shards ?? 0

  return (
    <div className="shard-tracker panel">
      <h3 className="shard-tracker__title">Your Shards</h3>
      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}
      {!loading && !error && (
        <>
          <output className="shard-tracker__count" aria-live="polite">
            <Icon name="gem" /> {count}
          </output>
          <p className="shard-tracker__note">Your DM gives and takes shards — you’ll see it the moment they do.</p>
        </>
      )}
    </div>
  )
}

function DmShards({ campaignId, playerId }) {
  const { items: rows, loading, error, addItem, updateItem } = useSupabaseTable('player_shards', {
    fromRow,
    filters: { campaign_id: campaignId },
  })
  const [players, setPlayers] = useState(null)
  const [playersError, setPlayersError] = useState(null)
  const [amounts, setAmounts] = useState({})
  // Counts changed here but not yet saved, shown instead of the saved row.
  const [pending, setPending] = useState({})
  const [flash, setFlash] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const pendingRef = useRef({})
  const rowIds = useRef({})
  const saving = useRef(new Set())
  const dirty = useRef(new Set())

  useEffect(() => {
    let cancelled = false
    listCampaignPlayers(campaignId)
      .then((list) => {
        if (!cancelled) setPlayers(list.filter((p) => p.role !== 'dm' && p.playerId !== playerId))
      })
      .catch((err) => !cancelled && setPlayersError(err.message))
    return () => {
      cancelled = true
    }
  }, [campaignId, playerId])

  const countFor = (pid) => pending[pid] ?? rows.find((r) => r.playerId === pid)?.shards ?? 0

  // Saves for one player never overlap: clicks while a save is in flight
  // just mark it dirty, and the loop writes the latest count when it's done.
  async function flush(pid) {
    if (saving.current.has(pid)) {
      dirty.current.add(pid)
      return
    }
    saving.current.add(pid)
    try {
      do {
        dirty.current.delete(pid)
        const shards = pendingRef.current[pid]
        const id = rowIds.current[pid] || rowsRef.current.find((r) => r.playerId === pid)?.id
        if (id) await updateItem(id, { shards })
        else rowIds.current[pid] = (await addItem({ player_id: pid, shards })).id
      } while (dirty.current.has(pid))
      setSaveError(null)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      saving.current.delete(pid)
      delete pendingRef.current[pid]
      setPending((p) => {
        const next = { ...p }
        delete next[pid]
        return next
      })
    }
  }

  function change(pid, sign) {
    const n = Math.max(1, Math.floor(Number(amounts[pid]) || 1))
    const current = countFor(pid)
    const next = Math.max(0, current + sign * n)
    if (next === current) return
    pendingRef.current[pid] = next
    setPending((p) => ({ ...p, [pid]: next }))
    setFlash({ pid, delta: next - current, key: Date.now() })
    flush(pid)
  }

  const busy = loading || players === null

  return (
    <div className="shard-tracker panel">
      <h3 className="shard-tracker__title">Player Shards</h3>
      <p className="shard-tracker__note">Give or take shards — each player sees it pop up on their screen.</p>
      {busy && !error && !playersError && <p className="empty-state">Loading…</p>}
      {(error || playersError) && <p className="empty-state empty-state--error">{error || playersError}</p>}
      {!busy && !error && players.length === 0 && <p className="empty-state">No players in this campaign yet.</p>}
      {!busy && !error && players.length > 0 && (
        <ul className="shard-tracker__players">
          {players.map((p) => {
            const name = p.displayName || p.username
            const count = countFor(p.playerId)
            const amount = Math.max(1, Math.floor(Number(amounts[p.playerId]) || 1))
            const shown = flash?.pid === p.playerId ? flash : null
            return (
              <li key={p.playerId} className="shard-tracker__player">
                <span className="shard-tracker__who">{name}</span>
                <span className="shard-tracker__player-count" aria-live="polite">
                  <Icon name="gem" /> {count}
                  {shown && (
                    <span
                      key={shown.key}
                      className={`shard-tracker__flash shard-tracker__flash--${shown.delta > 0 ? 'gain' : 'loss'}`}
                      aria-hidden="true"
                    >
                      {shown.delta > 0 ? '+' : '−'}
                      {Math.abs(shown.delta)}
                    </span>
                  )}
                </span>
                <div className="shard-tracker__give">
                  <button
                    type="button"
                    className="shard-tracker__step"
                    onClick={() => change(p.playerId, -1)}
                    disabled={count === 0}
                    aria-label={`Take ${plural(amount)} from ${name}`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    className="shard-tracker__amount-input"
                    value={amounts[p.playerId] ?? ''}
                    placeholder="1"
                    aria-label={`How many shards for ${name}`}
                    onChange={(e) => setAmounts((a) => ({ ...a, [p.playerId]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="shard-tracker__step"
                    onClick={() => change(p.playerId, 1)}
                    aria-label={`Give ${plural(amount)} to ${name}`}
                  >
                    +
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {saveError && <p className="empty-state empty-state--error">Couldn’t save: {saveError}</p>}
    </div>
  )
}

export default ShardTracker
