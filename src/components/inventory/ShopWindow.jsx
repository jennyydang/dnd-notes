import { useState } from 'react'
import { useSupabaseTable } from '../../hooks/useSupabaseTable.js'
import { supabase } from '../../lib/supabaseClient.js'
import { copyImage, getPublicUrl } from '../../lib/storage.js'
import { addToCounts, formatCoins, spendFromCounts, totalValue } from '../../lib/currency.js'
import { BAGS, bagOf, findStack, stacks } from '../../lib/inventory.js'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import ItemIcon from './ItemIcon.jsx'

export const merchantFromRow = (r) => ({
  id: r.id,
  name: r.name,
  greeting: r.greeting || '',
  photoPath: r.photo_path || null,
  photo: getPublicUrl('npc-portraits', r.photo_path),
  isOpen: Boolean(r.is_open),
  sellRate: Number(r.sell_rate ?? 0.5),
  createdAt: r.created_at,
})

export const stockFromRow = (r) => ({
  id: r.id,
  merchantId: r.merchant_id,
  item: r.item,
  bag: r.bag || '',
  kind: r.kind || '',
  notes: r.notes || '',
  photoPath: r.photo_path || null,
  photo: getPublicUrl('loot-photos', r.photo_path),
  priceCp: r.price_cp ?? 0,
  stock: r.stock ?? null,
  usable: Boolean(r.usable),
  createdAt: r.created_at,
})

const emptyPurse = { platinum: 0, gold: 0, silver: 0, shilling: 0, copper: 0 }

// A merchant's shop, MapleStory style: their wares on one side, your
// items on the other. Buying pays from your wallet and puts the item in
// the inventory you have open (stacking onto what you already carry);
// selling pays you the merchant's share of what the item is worth.
function ShopWindow({ campaignId, playerId, merchantId, owner, loot, lootTable, wallet, walletTable, onClose }) {
  const merchantRows = useSupabaseTable('merchants', { fromRow: merchantFromRow, filters: { id: merchantId } })
  const stockTable = useSupabaseTable('merchant_items', { fromRow: stockFromRow, filters: { merchant_id: merchantId } })
  const merchant = merchantRows.items[0]
  const [picked, setPicked] = useState(null) // { side: 'buy' | 'sell', id }
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { text, error }

  const purse = wallet ? totalValue(wallet) : 0
  const sellable = loot.filter((l) => l.holder.trim().toLowerCase() === owner.holder.trim().toLowerCase() && l.valueCp != null)
  const wares = stockTable.items

  function pick(side, id) {
    setPicked(picked?.side === side && picked.id === id ? null : { side, id })
    setQty(1)
    setMessage(null)
  }

  async function run(task) {
    setBusy(true)
    setMessage(null)
    try {
      setMessage({ text: await task() })
      setPicked(null)
      setQty(1)
    } catch (err) {
      setMessage({ text: err.message, error: true })
    } finally {
      setBusy(false)
    }
  }

  const buy = (ware, count) =>
    run(async () => {
      if (!playerId) throw new Error('Only players can buy — the DM and admin have no coin purse.')
      const cost = ware.priceCp * count
      if (!wallet) throw new Error('You have no coins yet. Add some in Tools → Wallet.')
      const newCounts = spendFromCounts(wallet, cost) // throws when it's too much
      // Check the stock again right before buying: someone may have just bought it.
      const { data: fresh, error: stockError } = await supabase.from('merchant_items').select('stock').eq('id', ware.id).maybeSingle()
      if (stockError) throw new Error(stockError.message)
      if (!fresh) throw new Error('That item isn’t for sale any more.')
      if (fresh.stock !== null && fresh.stock < count) throw new Error(fresh.stock ? `Only ${fresh.stock} left.` : 'Sold out.')
      await walletTable.updateItem(wallet.id, newCounts)
      if (fresh.stock !== null) await stockTable.updateItem(ware.id, { stock: fresh.stock - count })

      const bag = ware.bag || bagOf({ item: ware.item, kind: ware.kind, usable: ware.usable })
      const stack = findStack(loot, { item: ware.item, holder: owner.holder, bag })
      if (stack) {
        await lootTable.updateItem(stack.id, { quantity: (stack.quantity ?? 1) + count, value_cp: stack.valueCp ?? ware.priceCp })
      } else {
        const photoPath = ware.photoPath ? await copyImage('loot-photos', ware.photoPath).catch(() => null) : null
        await lootTable.addItem({
          item: ware.item,
          kind: ware.kind,
          bag,
          notes: ware.notes,
          usable: ware.usable,
          quantity: stacks(bag) ? count : null,
          holder: owner.holder,
          found_at: `Bought from ${merchant?.name || 'a merchant'}`,
          value_cp: ware.priceCp,
          photo_path: photoPath,
        })
      }
      return `Bought ${count > 1 ? `${count} × ` : ''}${ware.item} for ${formatCoins(cost)}.`
    })

  const sell = (entry, count) =>
    run(async () => {
      if (!playerId) throw new Error('Only players can sell — the DM and admin have no coin purse.')
      const each = Math.floor((entry.valueCp || 0) * (merchant?.sellRate ?? 0.5))
      const earned = each * count
      const remaining = entry.quantity !== null ? entry.quantity - count : 0
      if (remaining > 0) await lootTable.updateItem(entry.id, { quantity: remaining })
      else await lootTable.removeItem(entry.id)
      if (wallet) await walletTable.updateItem(wallet.id, addToCounts(wallet, earned))
      else await walletTable.addItem(addToCounts(emptyPurse, earned))
      return `Sold ${count > 1 ? `${count} × ` : ''}${entry.item} for ${formatCoins(earned)}.`
    })

  const ware = picked?.side === 'buy' ? wares.find((w) => w.id === picked.id) : null
  const owned = picked?.side === 'sell' ? sellable.find((l) => l.id === picked.id) : null
  const wareBag = ware ? ware.bag || bagOf(ware) : null
  const maxBuy = ware ? Math.max(1, Math.min(ware.stock ?? 99, stacks(wareBag) ? 99 : 1)) : 1
  const maxSell = owned ? (owned.quantity !== null ? Math.max(1, owned.quantity) : 1) : 1

  return (
    <Modal onClose={onClose} label={merchant ? `${merchant.name}’s shop` : 'Shop'}>
      <div className="shop">
        <header className="shop__header">
          <span className="shop__face" aria-hidden="true">
            {merchant?.photo ? <img src={merchant.photo} alt="" /> : <Icon name="coins" />}
          </span>
          <div className="shop__who">
            <h3 className="shop__name">{merchant?.name || 'Shop'}</h3>
            {merchant?.greeting && <p className="shop__bubble">{merchant.greeting}</p>}
            {merchant && !merchant.isOpen && <p className="field-error">This shop has closed.</p>}
          </div>
        </header>

        <div className="shop__panes">
          <section className="game-window shop__pane" aria-label="For sale">
            <header className="game-window__title">
              <span>For sale</span>
            </header>
            <ul className="shop__list">
              {wares.length === 0 && <li className="shop__empty">Nothing for sale yet.</li>}
              {wares.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    className={`shop__row${picked?.side === 'buy' && picked.id === w.id ? ' is-picked' : ''}`}
                    onClick={() => pick('buy', w.id)}
                    disabled={w.stock === 0}
                  >
                    <span className="inv-slot shop__icon">
                      <ItemIcon entry={w} bag={w.bag || bagOf(w)} />
                    </span>
                    <span className="shop__row-text">
                      <span className="shop__item">{w.item}</span>
                      <span className="shop__meta">
                        {BAGS.find((b) => b.id === (w.bag || bagOf(w)))?.label}
                        {w.stock !== null && ` · ${w.stock === 0 ? 'Sold out' : `${w.stock} left`}`}
                      </span>
                    </span>
                    <span className="shop__price">{formatCoins(w.priceCp)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="game-window shop__pane" aria-label="Your items to sell">
            <header className="game-window__title">
              <span>{owner.label}</span>
              <span className="game-window__owner">sells at {Math.round((merchant?.sellRate ?? 0.5) * 100)}%</span>
            </header>
            <ul className="shop__list">
              {sellable.length === 0 && <li className="shop__empty">Nothing to sell. Items bought from merchants can be sold back.</li>}
              {sellable.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`shop__row${picked?.side === 'sell' && picked.id === l.id ? ' is-picked' : ''}`}
                    onClick={() => pick('sell', l.id)}
                  >
                    <span className="inv-slot shop__icon">
                      <ItemIcon entry={l} />
                      {l.quantity !== null && <span className="inv-slot__qty">{l.quantity}</span>}
                    </span>
                    <span className="shop__row-text">
                      <span className="shop__item">{l.item}</span>
                      <span className="shop__meta">{l.equipped ? 'Equipped' : BAGS.find((b) => b.id === bagOf(l))?.label}</span>
                    </span>
                    <span className="shop__price">{formatCoins(Math.floor(l.valueCp * (merchant?.sellRate ?? 0.5)))}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {(ware || owned) && (
          <div className="shop__deal">
            {ware?.notes && <p className="shop__notes">{ware.notes}</p>}
            <div className="shop__deal-row">
              {(ware ? maxBuy : maxSell) > 1 && (
                <label className="shop__qty">
                  How many
                  <input
                    type="number"
                    min="1"
                    max={ware ? maxBuy : maxSell}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(ware ? maxBuy : maxSell, Math.floor(Number(e.target.value) || 1))))}
                  />
                </label>
              )}
              {ware ? (
                <button type="button" className="btn btn--primary" disabled={busy || !merchant?.isOpen} onClick={() => buy(ware, qty)}>
                  <Icon name="coins" /> Buy for {formatCoins(ware.priceCp * qty)}
                </button>
              ) : (
                <button type="button" className="btn btn--primary" disabled={busy || !merchant?.isOpen} onClick={() => sell(owned, qty)}>
                  <Icon name="coins" /> Sell for {formatCoins(Math.floor(owned.valueCp * (merchant?.sellRate ?? 0.5)) * qty)}
                </button>
              )}
            </div>
          </div>
        )}

        {message && (
          <p className={message.error ? 'field-error' : 'shop__done'} role="status">
            {message.text}
          </p>
        )}

        <footer className="game-window__footer shop__footer">
          <span className="game-window__coin" aria-hidden="true" />
          <span className="game-window__purse">{playerId ? formatCoins(purse) : '—'}</span>
          <span className="shop__into">Buying into: {owner.label}</span>
          <button type="button" className="btn btn--text" onClick={onClose}>
            Leave shop
          </button>
        </footer>
      </div>
    </Modal>
  )
}

export default ShopWindow
