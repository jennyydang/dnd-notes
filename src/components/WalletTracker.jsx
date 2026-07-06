import { useEffect, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { listCampaignMembers } from '../lib/campaigns.js'
import { CURRENCIES, formatAmount, toCopper } from '../lib/currency.js'

const fromRow = (r) => ({
  id: r.id,
  playerId: r.player_id,
  totalCopper: Number(r.total_copper),
})

function WalletTracker({ campaignId, playerId }) {
  const {
    items: wallets,
    loading,
    error,
    addItem,
    updateItem,
  } = useSupabaseTable('player_wallets', {
    fromRow,
    filters: playerId
      ? { campaign_id: campaignId, player_id: playerId }
      : { campaign_id: campaignId },
  })
  const [usernames, setUsernames] = useState({})
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('gold')
  const [txError, setTxError] = useState(null)

  useEffect(() => {
    let cancelled = false
    listCampaignMembers(campaignId)
      .then((members) => {
        if (cancelled) return
        const map = {}
        for (const member of members) map[member.playerId] = member.username
        setUsernames(map)
      })
      .catch(() => {
        // Non-critical: admin view just falls back to "Unknown player".
      })
    return () => {
      cancelled = true
    }
  }, [campaignId])

  const myWallet = playerId ? wallets.find((w) => w.playerId === playerId) : null
  const myBalance = myWallet?.totalCopper ?? 0

  async function saveBalance(newTotal) {
    setTxError(null)
    try {
      if (myWallet) {
        await updateItem(myWallet.id, { total_copper: newTotal })
      } else {
        await addItem({ total_copper: newTotal })
      }
      setAmount('')
    } catch (err) {
      setTxError(err.message)
    }
  }

  function handleSet() {
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n < 0) return
    saveBalance(toCopper(n, currency))
  }

  function handleSpend() {
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) return
    saveBalance(myBalance - toCopper(n, currency))
  }

  function handleEarn() {
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) return
    saveBalance(myBalance + toCopper(n, currency))
  }

  if (!playerId) {
    return (
      <div className="wallet-tracker panel">
        <h3 className="wallet-tracker__title">Money Tracker</h3>
        {loading && <p className="empty-state">Loading…</p>}
        {error && <p className="empty-state empty-state--error">{error}</p>}
        {!loading && !error && wallets.length === 0 && (
          <p className="empty-state">No player wallets recorded yet.</p>
        )}
        {!loading && !error && wallets.length > 0 && (
          <ul className="wallet-tracker__admin-list">
            {wallets.map((w) => (
              <li key={w.id} className="wallet-tracker__admin-row">
                <span className="wallet-tracker__admin-name">
                  {usernames[w.playerId] || 'Unknown player'}
                </span>
                <span className="wallet-tracker__admin-balance">
                  {formatAmount(w.totalCopper / 1000)} gold
                  {' · '}
                  {formatAmount(w.totalCopper / 1)} copper
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="wallet-tracker panel">
      <h3 className="wallet-tracker__title">Money Tracker</h3>

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && (
        <dl className="wallet-tracker__balance">
          {CURRENCIES.map((c) => (
            <div key={c.id}>
              <dt>{c.label}</dt>
              <dd className={myBalance < 0 ? 'wallet-tracker__balance-value--negative' : ''}>
                {formatAmount(myBalance / c.copperValue)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="wallet-tracker__transaction">
        <div className="field">
          <label htmlFor="wallet-amount">Amount</label>
          <input
            id="wallet-amount"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="field">
          <label htmlFor="wallet-currency">Currency</label>
          <select
            id="wallet-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="wallet-tracker__actions">
          <button type="button" className="btn btn--text" onClick={handleSet}>
            Set Balance
          </button>
          <button type="button" className="btn btn--danger" onClick={handleSpend}>
            Spend
          </button>
          <button type="button" className="btn btn--primary" onClick={handleEarn}>
            Add
          </button>
        </div>
      </div>
      {txError && <p className="empty-state empty-state--error">{txError}</p>}
    </div>
  )
}

export default WalletTracker
