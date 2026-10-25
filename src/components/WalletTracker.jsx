import { useEffect, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { listCampaignMembers } from '../lib/campaigns.js'
import { CURRENCIES, formatAmount, spendFromCounts, toCopper, totalValue } from '../lib/currency.js'
import AnimatedNumber from './AnimatedNumber.jsx'

const emptyCounts = { platinum: 0, gold: 0, silver: 0, shilling: 0, copper: 0 }

const fromRow = (r) => ({
  id: r.id,
  playerId: r.player_id,
  platinum: r.platinum,
  gold: r.gold,
  silver: r.silver,
  shilling: r.shilling,
  copper: r.copper,
})

function describeCounts(counts) {
  return CURRENCIES.map((c) => `${counts[c.id]} ${c.label.toLowerCase()}`).join(', ')
}

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
  const [counts, setCounts] = useState(emptyCounts)
  const [initialized, setInitialized] = useState(false)
  const [txError, setTxError] = useState(null)
  const [txNote, setTxNote] = useState(null)
  const [txAmount, setTxAmount] = useState('')
  const [txCurrency, setTxCurrency] = useState('gold')

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

  // Seed the editable form from the saved wallet exactly once — after
  // that, local edits are the source of truth until Save persists them
  // (re-syncing on every refetch would clobber whatever the player is
  // mid-typing).
  useEffect(() => {
    if (myWallet && !initialized) {
      setCounts({
        platinum: myWallet.platinum,
        gold: myWallet.gold,
        silver: myWallet.silver,
        shilling: myWallet.shilling,
        copper: myWallet.copper,
      })
      setInitialized(true)
    }
  }, [myWallet, initialized])

  function updateCount(id, value) {
    const n = Math.max(0, Math.floor(Number(value) || 0))
    setCounts((prev) => ({ ...prev, [id]: n }))
  }

  async function persist(newCounts) {
    setTxError(null)
    try {
      if (myWallet) {
        await updateItem(myWallet.id, newCounts)
      } else {
        await addItem(newCounts)
      }
      setCounts(newCounts)
    } catch (err) {
      setTxError(err.message)
      throw err
    }
  }

  async function saveWallet() {
    setTxNote(null)
    try {
      await persist(counts)
    } catch {
      // txError is already set by persist(); nothing further to do here.
    }
  }

  async function handleSpend() {
    setTxNote(null)
    const n = parseFloat(txAmount)
    if (!Number.isFinite(n) || n <= 0) return
    try {
      const newCounts = spendFromCounts(counts, toCopper(n, txCurrency))
      await persist(newCounts)
      setTxNote(`Spent ${n} ${txCurrency}. New balance: ${describeCounts(newCounts)}.`)
      setTxAmount('')
    } catch (err) {
      setTxError(err.message)
    }
  }

  async function handleEarn() {
    setTxNote(null)
    const n = parseFloat(txAmount)
    if (!Number.isFinite(n) || n <= 0) return
    const newCounts = { ...counts, [txCurrency]: counts[txCurrency] + Math.floor(n) }
    try {
      await persist(newCounts)
      setTxNote(`Earned ${n} ${txCurrency}. New balance: ${describeCounts(newCounts)}.`)
      setTxAmount('')
    } catch {
      // txError is already set by persist().
    }
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
                  {CURRENCIES.map((c) => `${w[c.id]} ${c.label.toLowerCase()}`).join(', ')}
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
        <>
          <div className="wallet-tracker__counts">
            {CURRENCIES.map((c) => (
              <div className="field" key={c.id}>
                <label htmlFor={`wallet-${c.id}`}>{c.label}</label>
                <input
                  id={`wallet-${c.id}`}
                  type="number"
                  min="0"
                  step="1"
                  value={counts[c.id]}
                  onChange={(e) => updateCount(c.id, e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="wallet-tracker__total">
            Total value: <AnimatedNumber value={totalValue(counts)} format={(n) => formatAmount(Math.round(n) / 1000)} />{' '}
            gold-equivalent
          </p>
          <button type="button" className="btn btn--primary" onClick={saveWallet}>
            Save
          </button>

          <div className="wallet-tracker__purchase">
            <h4 className="wallet-tracker__purchase-title">Buy or Sell Something</h4>
            <p className="wallet-tracker__note">
              Spending more of a coin than you have breaks a higher denomination
              for change, same as a real coin purse.
            </p>
            <div className="wallet-tracker__purchase-inputs">
              <div className="field">
                <label htmlFor="wallet-tx-amount">Amount</label>
                <input
                  id="wallet-tx-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="field">
                <label htmlFor="wallet-tx-currency">Currency</label>
                <select
                  id="wallet-tx-currency"
                  value={txCurrency}
                  onChange={(e) => setTxCurrency(e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="wallet-tracker__purchase-actions">
                <button type="button" className="btn btn--danger" onClick={handleSpend}>
                  Spend
                </button>
                <button type="button" className="btn btn--text" onClick={handleEarn}>
                  Earn
                </button>
              </div>
            </div>
            {txNote && <p className="wallet-tracker__note">{txNote}</p>}
          </div>
        </>
      )}
      {txError && <p className="empty-state empty-state--error">{txError}</p>}
    </div>
  )
}

export default WalletTracker
