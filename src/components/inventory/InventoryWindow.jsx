import { useEffect, useMemo, useState } from 'react'
import { useSupabaseTable } from '../../hooks/useSupabaseTable.js'
import { useCampaignData, useCampaignNav } from '../../hooks/useCampaignData.js'
import { getPublicUrl } from '../../lib/storage.js'
import { formatCoins, totalValue } from '../../lib/currency.js'
import { BAGS, STASH, bagOf, layoutBag, moveSlot, ownerKey, stacks } from '../../lib/inventory.js'
import { confirmDelete } from '../../lib/confirm.js'
import { RichText } from '../RichText.jsx'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import ShopWindow from './ShopWindow.jsx'
import TradeWindow from './TradeWindow.jsx'
import { ACTIVE, tradeFromRow } from '../../lib/trade.js'
import { notifyPlayer } from '../../lib/notifications.js'
import { equipChanges, freeSlotFor, layoutEquipment, slotLabel, unequipPatch } from '../../lib/equipment.js'
import EquipmentWindow from './EquipmentWindow.jsx'
import ItemIcon from './ItemIcon.jsx'
import './Inventory.scss'

const LOOT_BUCKET = 'loot-photos'
const BAG_KEY = 'dnd-notes-inventory-bag'
const SCHEMA_HINT = 'Run the latest supabase/schema.sql first (it adds inventory bags and slots).'
const EQUIP_HINT = 'Run the latest supabase/schema.sql first (it adds equipment slots).'
// Taking an item off: equip_slot is only written when it had one, so this
// works before the equipment SQL has been run.
const offPatch = (entry) => (entry.equipSlot ? unequipPatch : { equipped: false })

export const invFromRow = (r) => ({
  id: r.id,
  item: r.item,
  kind: r.kind || '',
  holder: r.holder || '',
  notes: r.notes || '',
  foundAt: r.found_at || '',
  usable: Boolean(r.usable),
  used: Boolean(r.used),
  quantity: r.quantity ?? null,
  photoPath: r.photo_path || null,
  photo: getPublicUrl(LOOT_BUCKET, r.photo_path),
  bag: r.bag || '',
  slot: r.slot ?? null,
  equipped: Boolean(r.equipped),
  equipSlot: r.equip_slot || null,
  valueCp: r.value_cp ?? null,
  createdAt: r.created_at,
})

export const isUsedUp = (e) => e.usable && (e.quantity !== null ? e.quantity <= 0 : e.used)
const walletFromRow = (r) => ({ id: r.id, platinum: r.platinum, gold: r.gold, silver: r.silver, shilling: r.shilling, copper: r.copper })
const merchantFromRow = (r) => ({ id: r.id, name: r.name, isOpen: r.is_open })

function readBag() {
  try {
    const saved = localStorage.getItem(BAG_KEY)
    return BAGS.some((b) => b.id === saved) ? saved : 'equip'
  } catch {
    return 'equip'
  }
}


// Who can hold things: the player's own characters first, the rest of
// the party, anyone else named as a holder, and the party stash.
function useOwners(loot, playerId) {
  const { tables } = useCampaignData()
  const party = tables.character?.items || []
  return useMemo(() => {
    const pcs = party.filter((m) => m.member_type !== 'NPC')
    const sorted = [...pcs.filter((m) => playerId && m.claimed_by === playerId), ...pcs.filter((m) => !playerId || m.claimed_by !== playerId)]
    const owners = sorted.map((m) => ({
      key: ownerKey(m.name),
      label: m.name,
      holder: m.name,
      photo: getPublicUrl('party-portraits', m.photo_path),
      mine: Boolean(playerId && m.claimed_by === playerId),
      playerId: m.claimed_by || null,
    }))
    const known = new Set(owners.map((o) => o.key))
    for (const l of loot) {
      const key = ownerKey(l.holder)
      if (key !== STASH && !known.has(key)) {
        known.add(key)
        owners.push({ key, label: l.holder.trim(), holder: l.holder.trim(), photo: '', mine: false })
      }
    }
    owners.push({ key: STASH, label: 'Party stash', holder: '', photo: '', mine: false })
    return owners
  }, [party, loot, playerId])
}

// MapleStory-style inventory: a window per character (and the party
// stash) with Equip / Use / Etc / Quest tabs, a grid of slots you can
// drag items between, the item's details, and the coin purse. Built on
// the Loot table, so it's the same items as the Loot list.
function InventoryWindow({ campaignId, playerId }) {
  const { openEntity } = useCampaignNav()
  const lootTable = useSupabaseTable('loot', { fromRow: invFromRow, filters: { campaign_id: campaignId } })
  const { items: allLoot, updateItem, removeItem, addItem } = lootTable
  const loot = useMemo(() => allLoot.filter((l) => !isUsedUp(l)), [allLoot])
  const wallets = useSupabaseTable('player_wallets', {
    fromRow: walletFromRow,
    filters: { campaign_id: campaignId, player_id: playerId || '00000000-0000-0000-0000-000000000000' },
  })
  const merchants = useSupabaseTable('merchants', { fromRow: merchantFromRow, filters: { campaign_id: campaignId } })
  const openShops = merchants.items.filter((m) => m.isOpen)
  const trades = useSupabaseTable('trades', { fromRow: tradeFromRow, filters: { campaign_id: campaignId }, ascending: false })
  const myTrades = playerId
    ? trades.items.filter((t) => ACTIVE.includes(t.status) && (t.fromPlayer === playerId || t.toPlayer === playerId))
    : []
  const invites = myTrades.filter((t) => t.status === 'invite' && t.toPlayer === playerId)
  const [tradeId, setTradeId] = useState(null)
  const openTrade = trades.items.find((t) => t.id === tradeId) || null

  const owners = useOwners(allLoot, playerId)
  const [ownerKeyState, setOwnerKey] = useState(null)
  const owner = owners.find((o) => o.key === ownerKeyState) || owners.find((o) => o.mine) || owners[owners.length - 1]
  const [bag, setBagState] = useState(readBag)
  const setBag = (id) => {
    setBagState(id)
    try {
      localStorage.setItem(BAG_KEY, id)
    } catch {
      // not remembered
    }
  }
  const [selectedId, setSelectedId] = useState(null)
  const [moving, setMoving] = useState(null) // id being moved by tap (touch)
  const [dragFrom, setDragFrom] = useState(null)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [shopId, setShopId] = useState(null)

  const ownerItems = loot.filter((l) => ownerKey(l.holder) === owner.key)
  // Worn items are on the equipment figure, not in the bag.
  const worn = useMemo(() => layoutEquipment(ownerItems), [ownerItems])
  const wornIds = new Set(Object.values(worn).map((w) => w.id))
  const inBag = ownerItems.filter((l) => !wornIds.has(l.id))
  const counts = Object.fromEntries(BAGS.map((b) => [b.id, inBag.filter((l) => bagOf(l) === b.id).length]))
  const slots = useMemo(() => layoutBag(inBag.filter((l) => bagOf(l) === bag)), [inBag, bag])
  const dragged = dragFrom ? loot.find((l) => l.id === dragFrom) || null : null
  const selected = loot.find((l) => l.id === selectedId) || null

  useEffect(() => {
    setSelectedId(null)
    setMoving(null)
  }, [owner.key, bag])

  async function save(id, patch) {
    setError(null)
    try {
      await updateItem(id, patch)
    } catch (err) {
      setError(/equip_slot/.test(err.message) ? EQUIP_HINT : /bag|slot|equipped|value_cp/.test(err.message) ? SCHEMA_HINT : err.message)
    }
  }

  async function equip(entry, slotId = freeSlotFor(entry, worn)) {
    for (const change of equipChanges(worn, entry, slotId)) {
      const target = loot.find((l) => l.id === change.id)
      // Old-style equipped items (no slot yet) only need equipped cleared.
      await save(change.id, change.patch.equipped ? change.patch : offPatch(target || {}))
    }
  }

  const unequip = (entry, extra = {}) => save(entry.id, { ...offPatch(entry), ...extra })

  // Something dropped on a bag slot: moved within the bag, or taken off.
  function dropOnSlot(index) {
    const item = dragged
    setDragFrom(null)
    if (!item) return
    if (wornIds.has(item.id)) {
      unequip(item, bagOf(item) === bag && !slots[index] ? { slot: index } : {})
      return
    }
    const from = slots.findIndex((s) => s?.id === item.id)
    if (from >= 0) moveTo(from, index)
  }

  async function moveTo(from, to) {
    for (const change of moveSlot(slots, from, to)) await save(change.id, { slot: change.slot })
  }

  function onSlotTap(index) {
    const item = slots[index]
    if (moving) {
      const from = slots.findIndex((s) => s?.id === moving)
      setMoving(null)
      if (from >= 0) moveTo(from, index)
      return
    }
    setSelectedId(item ? (item.id === selectedId ? null : item.id) : null)
  }

  async function useItem(entry) {
    if (entry.quantity !== null) await save(entry.id, { quantity: Math.max(0, entry.quantity - 1) })
    else await save(entry.id, { used: true })
  }

  async function giveTo(entry, target) {
    await save(entry.id, { holder: target.holder, slot: null, ...offPatch(entry) })
    setSelectedId(null)
  }

  async function discard(entry) {
    if (!confirmDelete(`“${entry.item}”`)) return
    try {
      await removeItem(entry.id)
      setSelectedId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const wallet = wallets.items[0]
  const purse = wallet ? totalValue(wallet) : 0

  // Trading is between players' characters: you trade as the character of
  // yours you last had open (or your first).
  const myOwners = owners.filter((o) => o.mine)
  const [tradingAs, setTradingAs] = useState(null)
  useEffect(() => {
    if (owner.mine) setTradingAs(owner.key)
  }, [owner.key, owner.mine])
  const me = myOwners.find((o) => o.key === tradingAs) || myOwners[0]
  const canTradeWith = playerId && me && owner.playerId && owner.playerId !== playerId

  async function startTrade() {
    setError(null)
    const existing = myTrades.find(
      (t) => (t.fromPlayer === owner.playerId || t.toPlayer === owner.playerId) && t.status !== 'executing',
    )
    if (existing) {
      setTradeId(existing.id)
      return
    }
    try {
      const row = await trades.addItem({
        from_player: playerId,
        to_player: owner.playerId,
        from_holder: me.holder,
        to_holder: owner.holder,
        status: 'invite',
      })
      setTradeId(row.id)
      notifyPlayer(owner.playerId, {
        kind: 'trade',
        title: `${me.label} wants to trade with ${owner.label}`,
        body: 'Open your inventory (Loot tab) to accept.',
      }).catch(() => {})
    } catch (err) {
      setError(/trades/.test(err.message) ? 'Run the latest supabase/schema.sql first (it adds trades).' : err.message)
    }
  }

  return (
    <div className="inventory">
      {openShops.length > 0 && (
        <div className="inventory__shops" role="status">
          {openShops.map((m) => (
            <button key={m.id} type="button" className="inventory__shop-open" onClick={() => setShopId(m.id)}>
              <Icon name="coins" /> <strong>{m.name}</strong> is open — visit the shop
            </button>
          ))}
        </div>
      )}

      {myTrades.length > 0 && (
        <div className="inventory__shops" role="status">
          {myTrades.map((t) => {
            const incoming = t.status === 'invite' && t.toPlayer === playerId
            const other = t.fromPlayer === playerId ? t.toHolder : t.fromHolder
            return (
              <div key={t.id} className="inventory__trade-banner">
                <Icon name="handshake" />
                <span>
                  {incoming ? (
                    <>
                      <strong>{t.fromHolder}</strong> wants to trade with {t.toHolder}
                    </>
                  ) : (
                    <>
                      Trade with <strong>{other}</strong> {t.status === 'invite' ? '— waiting for them' : 'in progress'}
                    </>
                  )}
                </span>
                {incoming ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={async () => {
                        await trades.updateItem(t.id, { status: 'open' })
                        setTradeId(t.id)
                      }}
                    >
                      Accept
                    </button>
                    <button type="button" className="btn btn--text" onClick={() => trades.updateItem(t.id, { status: 'declined' })}>
                      Decline
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn" onClick={() => setTradeId(t.id)}>
                    Open
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="inventory__owners" role="tablist" aria-label="Whose inventory">
        {owners.map((o) => (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={o.key === owner.key}
            className={`inventory__owner${o.key === owner.key ? ' is-active' : ''}`}
            onClick={() => setOwnerKey(o.key)}
            onDragOver={(e) => dragFrom != null && o.key !== owner.key && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const item = dragged
              setDragFrom(null)
              if (item) giveTo(item, o)
            }}
          >
            <span className="inventory__owner-face" aria-hidden="true">
              {o.photo ? <img src={o.photo} alt="" /> : o.key === STASH ? <Icon name="backpack" /> : o.label.charAt(0)}
            </span>
            {o.label}
            {o.mine && <span className="inventory__you">you</span>}
          </button>
        ))}
      </div>

      {canTradeWith && (
        <button type="button" className="btn inventory__trade" onClick={startTrade}>
          <Icon name="handshake" /> Trade with {owner.label}
          {myOwners.length > 1 ? ` as ${me.label}` : ''}
        </button>
      )}

      <div className="inventory__layout">
        <section className="game-window inventory__window" aria-label={`${owner.label}’s inventory`}>
          <header className="game-window__title">
            <span>Item inventory</span>
            <span className="game-window__owner">{owner.label}</span>
          </header>
          <div className="game-window__tabs" role="tablist" aria-label="Bags">
            {BAGS.map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={bag === b.id}
                className={`game-window__tab${bag === b.id ? ' is-active' : ''}`}
                onClick={() => setBag(b.id)}
                onDragOver={(e) => dragFrom != null && b.id !== bag && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const item = dragged
                  setDragFrom(null)
                  if (item) save(item.id, { bag: b.id, slot: null, ...offPatch(item) })
                }}
              >
                {b.label}
                {counts[b.id] > 0 && <span className="game-window__count">{counts[b.id]}</span>}
              </button>
            ))}
          </div>

          {moving && (
            <p className="inventory__moving" role="status">
              Tap a slot to move it there.{' '}
              <button type="button" className="btn btn--text" onClick={() => setMoving(null)}>
                Cancel
              </button>
            </p>
          )}

          <div className="inventory__grid-wrap">
            <ol className="inventory__grid" aria-label={`${BAGS.find((b) => b.id === bag).label} items`}>
              {slots.map((item, index) => (
                <li
                  key={item ? item.id : `empty-${index}`}
                  className={`inv-slot${item ? '' : ' inv-slot--empty'}${item?.id === selectedId ? ' is-selected' : ''}${
                    item?.equipped ? ' is-equipped' : ''
                  }${item?.id === moving ? ' is-moving' : ''}${item && (item.kind === 'Magic Item' || item.kind === 'Artifact') ? ' is-magic' : ''}`}
                  onDragOver={(e) => dragFrom != null && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    dropOnSlot(index)
                  }}
                >
                  <button
                    type="button"
                    className="inv-slot__button"
                    draggable={Boolean(item)}
                    onDragStart={() => item && setDragFrom(item.id)}
                    onDragEnd={() => setDragFrom(null)}
                    onClick={() => onSlotTap(index)}
                    aria-label={
                      item
                        ? `${item.item}${item.quantity !== null ? `, ${item.quantity}` : ''}${item.equipped ? ', equipped' : ''}`
                        : moving
                          ? `Empty slot ${index + 1}: move here`
                          : `Empty slot ${index + 1}`
                    }
                    tabIndex={item || moving ? 0 : -1}
                  >
                    {item && (
                      <>
                        <ItemIcon entry={item} bag={bag} />
                        {item.quantity !== null && <span className="inv-slot__qty">{item.quantity}</span>}
                        {item.equipped && <span className="inv-slot__equipped">E</span>}
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <footer className="game-window__footer">
            <span className="game-window__coin" aria-hidden="true" />
            <span className="game-window__purse" aria-label="Your coins">
              {playerId ? formatCoins(purse) : '—'}
            </span>
            <button type="button" className="game-window__add" onClick={() => setAdding(true)} aria-label="Add an item">
              <Icon name="plus" />
            </button>
          </footer>
        </section>

        <EquipmentWindow
          owner={owner}
          worn={worn}
          bagItems={inBag}
          selectedId={selectedId}
          dragged={dragged}
          onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
          onDragStart={(id) => setDragFrom(id)}
          onDragEnd={() => setDragFrom(null)}
          onEquip={(item, slotId) => {
            setDragFrom(null)
            equip(item, slotId)
          }}
        />

        <ItemDetails
          entry={selected}
          bag={bag}
          owners={owners}
          ownerKeyNow={owner.key}
          wornSlot={selected ? Object.keys(worn).find((k) => worn[k].id === selected.id) || null : null}
          onUse={useItem}
          onEquip={(e) => equip(e)}
          onUnequip={(e) => unequip(e)}
          onMove={(e) => {
            setMoving(e.id)
            setSelectedId(null)
          }}
          onBag={(e, b) => save(e.id, { bag: b, slot: null, ...(b === 'equip' ? {} : offPatch(e)) })}
          onGive={giveTo}
          onDiscard={discard}
          onOpen={(e) => openEntity('loot', e.id)}
        />
      </div>

      {error && <p className="field-error">{error}</p>}
      <p className="inventory__hint">
        Drag items between slots, onto a bag tab, onto the equipment figure, or onto someone’s name to hand them over. On a
        phone, tap an item and choose Move or Equip, or tap an empty gear slot.
      </p>

      {adding && (
        <AddItemDialog
          bag={bag}
          owner={owner}
          onClose={() => setAdding(false)}
          onAdd={async (row) => {
            try {
              await addItem(row)
              setAdding(false)
            } catch (err) {
              throw new Error(/bag/.test(err.message) ? SCHEMA_HINT : err.message)
            }
          }}
        />
      )}

      {openTrade && (
        <TradeWindow
          trade={openTrade}
          playerId={playerId}
          loot={loot}
          wallet={wallet}
          tradesTable={trades}
          onClose={() => setTradeId(null)}
        />
      )}

      {shopId && (
        <ShopWindow
          campaignId={campaignId}
          playerId={playerId}
          merchantId={shopId}
          owner={owner}
          owners={owners}
          loot={loot}
          lootTable={lootTable}
          wallet={wallet}
          walletTable={wallets}
          onClose={() => setShopId(null)}
        />
      )}
    </div>
  )
}

// The dark tooltip box: the selected item and what you can do with it.
function ItemDetails({ entry, bag, owners, ownerKeyNow, wornSlot, onUse, onEquip, onUnequip, onMove, onBag, onGive, onDiscard, onOpen }) {
  if (!entry) {
    return (
      <aside className="item-details item-details--empty">
        <p>Tap an item to see it.</p>
      </aside>
    )
  }
  const others = owners.filter((o) => o.key !== ownerKeyNow)
  const entryBag = bagOf(entry)
  return (
    <aside className="item-details" aria-label={`${entry.item} details`}>
      <h4 className="item-details__name">
        <span aria-hidden="true">•</span> {entry.item}
      </h4>
      <div className="item-details__body">
        <span className={`item-details__icon${entry.kind === 'Magic Item' || entry.kind === 'Artifact' ? ' is-magic' : ''}`}>
          <ItemIcon entry={entry} bag={bag} />
        </span>
        <div className="item-details__text">
          {entry.notes ? <RichText className="item-details__notes" value={entry.notes} /> : <p className="item-details__muted">No description.</p>}
          <ul className="item-details__facts">
            {entry.kind && <li className="item-details__kind">{entry.kind}</li>}
            {entry.quantity !== null && <li>Quantity: {entry.quantity}</li>}
            {entry.valueCp != null && <li>Worth {formatCoins(entry.valueCp)}</li>}
            {entry.foundAt && <li>Found: {entry.foundAt}</li>}
            {wornSlot ? (
              <li className="item-details__equipped">Worn: {slotLabel(wornSlot)}</li>
            ) : (
              entry.equipped && <li className="item-details__equipped">Equipped</li>
            )}
          </ul>
        </div>
      </div>
      <div className="item-details__actions">
        {entry.usable && (
          <button type="button" className="btn btn--primary" onClick={() => onUse(entry)}>
            <Icon name="flame" /> Use{entry.quantity !== null ? ' one' : ''}
          </button>
        )}
        {(entryBag === 'equip' || wornSlot) && (
          <button type="button" className="btn" onClick={() => (wornSlot ? onUnequip(entry) : onEquip(entry))}>
            <Icon name="shield" /> {wornSlot ? 'Take off' : 'Equip'}
          </button>
        )}
        <button type="button" className="btn" onClick={() => onMove(entry)}>
          <Icon name="move" /> Move
        </button>
        <label className="item-details__select">
          <span>Bag</span>
          <select value={entryBag} onChange={(e) => onBag(entry, e.target.value)}>
            {BAGS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        {others.length > 0 && (
          <label className="item-details__select">
            <span>Give to</span>
            <select
              value=""
              onChange={(e) => {
                const target = others.find((o) => o.key === e.target.value)
                if (target) onGive(entry, target)
              }}
            >
              <option value="">Choose…</option>
              {others.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="btn btn--text" onClick={() => onOpen(entry)}>
          <Icon name="edit" /> Edit details
        </button>
        <button type="button" className="btn btn--text item-details__discard" onClick={() => onDiscard(entry)}>
          <Icon name="trash" /> Discard
        </button>
      </div>
    </aside>
  )
}

function AddItemDialog({ bag, owner, onClose, onAdd }) {
  const [form, setForm] = useState({ item: '', bag, quantity: '', notes: '', usable: bag === 'use' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!form.item.trim()) return
    setSaving(true)
    setError(null)
    const qty = form.quantity === '' ? null : Math.max(0, Math.min(9999, Math.floor(Number(form.quantity) || 0)))
    try {
      await onAdd({
        item: form.item.trim(),
        bag: form.bag,
        holder: owner.holder,
        notes: form.notes.trim(),
        usable: form.usable,
        quantity: stacks(form.bag) ? qty : null,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} label="Add an item" size="narrow">
      <form className="form-stack" onSubmit={submit}>
        <h3 className="section-card__title">
          <Icon name="plus" /> Add to {owner.label}
        </h3>
        <div className="field">
          <label htmlFor="inv-add-name">Item</label>
          <input id="inv-add-name" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="Potion of Healing" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="inv-add-bag">Bag</label>
          <select id="inv-add-bag" value={form.bag} onChange={(e) => setForm({ ...form, bag: e.target.value, usable: e.target.value === 'use' })}>
            {BAGS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        {stacks(form.bag) && (
          <div className="field">
            <label htmlFor="inv-add-qty">How many</label>
            <input id="inv-add-qty" type="number" min="0" max="9999" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="Leave blank for one" />
          </div>
        )}
        <div className="field">
          <label htmlFor="inv-add-notes">Description</label>
          <textarea id="inv-add-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Heals 2d4+2 hit points." />
        </div>
        <label className="inventory__check">
          <input type="checkbox" checked={form.usable} onChange={(e) => setForm({ ...form, usable: e.target.checked })} /> Can be used up (potion,
          scroll, charge)
        </label>
        {error && <p className="field-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !form.item.trim()}>
            Add item
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default InventoryWindow
