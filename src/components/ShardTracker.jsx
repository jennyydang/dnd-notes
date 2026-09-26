import { useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { listCampaignMembers } from '../lib/campaigns.js'

const fromRow = (r) => ({ id: r.id, playerId: r.player_id, shards: r.shards })

// How many shards the DM has handed each player. Same scoping as the
// Money Tracker: a player sees and edits only their own count; the admin
// (no playerId) gets a read-only list of everyone's.
function ShardTracker({ campaignId, playerId }) {
  const { items: rows, loading, error, addItem, updateItem } = useSupabaseTable('player_shards', {
    fromRow,
    filters: playerId
      ? { campaign_id: campaignId, player_id: playerId }
      : { campaign_id: campaignId },
  })
  const [usernames, setUsernames] = useState({})
  const [count, setCount] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState(null)
  const [saveError, setSaveError] = useState(null)

  // Clicks change the number on screen immediately and are saved in the
  // background. Saves never overlap: if the player clicks again while one
  // is in flight, the loop writes the latest count once it finishes —
  // so rapid clicking can't insert two rows or land out of order.
  const countRef = useRef(0)
  const rowIdRef = useRef(null)
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (playerId) return
    let cancelled = false
    listCampaignMembers(campaignId)
      .then((members) => {
        if (cancelled) return
        setUsernames(Object.fromEntries(members.map((m) => [m.playerId, m.username])))
      })
      .catch(() => {
        // Non-critical: the admin list just falls back to "Unknown player".
      })
    return () => {
      cancelled = true
    }
  }, [campaignId, playerId])

  const myRow = playerId ? rows.find((r) => r.playerId === playerId) : null

  // Seed from the saved row once; after that local state is the source
  // of truth (a background refetch mustn't undo clicks not yet saved).
  useEffect(() => {
    if (initialized || loading || !playerId) return
    if (myRow) {
      countRef.current = myRow.shards
      rowIdRef.current = myRow.id
      setCount(myRow.shards)
    }
    setInitialized(true)
  }, [myRow, loading, initialized, playerId])

  async function flush() {
    if (savingRef.current) {
      dirtyRef.current = true
      return
    }
    savingRef.current = true
    try {
      do {
        dirtyRef.current = false
        const shards = countRef.current
        if (rowIdRef.current) {
          await updateItem(rowIdRef.current, { shards })
        } else {
          const row = await addItem({ shards })
          rowIdRef.current = row.id
        }
      } while (dirtyRef.current)
      setSaveError(null)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      savingRef.current = false
    }
  }

  function change(delta) {
    const next = Math.max(0, countRef.current + delta)
    const applied = next - countRef.current
    if (applied === 0) {
      setNote(delta < 0 ? 'You have no shards to take away.' : null)
      return
    }
    setNote(
      applied !== delta
        ? `You only had ${countRef.current} — removed ${-applied}.`
        : delta > 0
          ? `Added ${delta} shard${delta === 1 ? '' : 's'}.`
          : `Removed ${-delta} shard${delta === -1 ? '' : 's'}.`,
    )
    countRef.current = next
    setCount(next)
    flush()
  }

  function changeByAmount(sign) {
    const n = Math.floor(Number(amount))
    if (!Number.isFinite(n) || n <= 0) return
    change(sign * n)
    setAmount('')
  }

  if (!playerId) {
    return (
      <div className="shard-tracker panel">
        <h3 className="shard-tracker__title">Player Shards</h3>
        {loading && <p className="empty-state">Loading…</p>}
        {error && <p className="empty-state empty-state--error">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="empty-state">No shards recorded yet.</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <ul className="shard-tracker__admin-list">
            {rows.map((r) => (
              <li key={r.id} className="shard-tracker__admin-row">
                <span>{usernames[r.playerId] || 'Unknown player'}</span>
                <span className="shard-tracker__admin-count">💎 {r.shards}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="shard-tracker panel">
      <h3 className="shard-tracker__title">Player Shards</h3>
      <p className="shard-tracker__note">Track the shards your DM has given you.</p>

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="shard-tracker__counter">
            <button
              type="button"
              className="shard-tracker__step"
              onClick={() => change(-1)}
              disabled={count === 0}
              aria-label="Remove one shard"
            >
              −
            </button>
            <output className="shard-tracker__count" aria-live="polite">
              <span aria-hidden="true">💎</span> {count}
            </output>
            <button
              type="button"
              className="shard-tracker__step"
              onClick={() => change(1)}
              aria-label="Add one shard"
            >
              +
            </button>
          </div>

          <div className="shard-tracker__amount">
            <div className="field">
              <label htmlFor="shard-amount">Amount</label>
              <input
                id="shard-amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <button type="button" className="btn btn--primary" onClick={() => changeByAmount(1)}>
              Add
            </button>
            <button type="button" className="btn btn--danger" onClick={() => changeByAmount(-1)}>
              Subtract
            </button>
          </div>

          {note && <p className="shard-tracker__note">{note}</p>}
        </>
      )}
      {saveError && <p className="empty-state empty-state--error">{saveError}</p>}
    </div>
  )
}

export default ShardTracker
