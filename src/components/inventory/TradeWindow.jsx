import { useEffect, useRef, useState } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { useImageCrop } from '../../hooks/useImageCrop.jsx'
import { supabase } from '../../lib/supabaseClient.js'
import { getPublicUrl, removeImage, uploadImage } from '../../lib/storage.js'
import { formatCoins, goldToCopper, totalValue } from '../../lib/currency.js'
import { ownerKey } from '../../lib/inventory.js'
import { executeTrade, offerPatch, sides } from '../../lib/trade.js'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import ItemIcon from './ItemIcon.jsx'

const OFFER_SLOTS = 6
const MAX_OFFER = 9

// One character's stage: their full-body sprite (or portrait), name and
// whether they've pressed Trade. Your own can take a new sprite.
function SpriteStage({ member, holder, ready, mine, onSprite }) {
  const sprite = member?.sprite_path ? getPublicUrl('party-portraits', member.sprite_path) : ''
  const portrait = member?.photo_path ? getPublicUrl('party-portraits', member.photo_path) : ''
  const crop = useImageCrop({ aspect: 3 / 4, shape: 'rect', onCropped: onSprite })
  return (
    <div className={`trade-stage${ready ? ' is-ready' : ''}`}>
      <div className="trade-stage__floor">
        {sprite ? (
          <img className="trade-stage__sprite" src={sprite} alt="" />
        ) : portrait ? (
          <img className="trade-stage__portrait" src={portrait} alt="" />
        ) : (
          <Icon name="user" size="3.5rem" />
        )}
        {ready && <span className="trade-stage__ready">Ready!</span>}
      </div>
      <span className="trade-stage__name">{holder}</span>
      {mine && member && (
        <label className="trade-stage__change">
          <Icon name="upload" /> {sprite ? 'Change sprite' : 'Add sprite'}
          <input type="file" accept="image/*" hidden onChange={crop.fromInput} />
        </label>
      )}
      {crop.dialog}
    </div>
  )
}

function OfferColumn({ label, offer, coins, loot, editable, onAdd, onRemove, onCoins, purse, settled }) {
  const [coinDraft, setCoinDraft] = useState(null)
  const rows = Array.from({ length: Math.max(OFFER_SLOTS, offer.length + (editable && offer.length < MAX_OFFER ? 1 : 0)) }, (_, i) => offer[i] || null)
  return (
    <section className="trade-offer" aria-label={label}>
      <ol className="trade-offer__rows">
        {rows.map((o, i) => {
          const item = o && loot.find((l) => l.id === o.id)
          return (
            <li key={o ? o.id : `empty-${i}`} className="trade-offer__row">
              <span className="inv-slot trade-offer__slot">
                {item && (
                  <span className="inv-slot__button">
                    <ItemIcon entry={item} />
                    {item.quantity !== null && <span className="inv-slot__qty">{o.qty}</span>}
                  </span>
                )}
              </span>
              {o ? (
                <span className="trade-offer__text">
                  <span className="trade-offer__name">{item ? item.item : settled ? 'Traded' : 'Item no longer there'}</span>
                  {item && item.quantity !== null && (
                    <span className="trade-offer__meta">{settled ? `× ${o.qty}` : `${o.qty} of ${item.quantity}`}</span>
                  )}
                </span>
              ) : editable && i === offer.length ? (
                <button type="button" className="trade-offer__add" onClick={onAdd}>
                  <Icon name="plus" /> Offer an item
                </button>
              ) : (
                <span className="trade-offer__text" />
              )}
              {o && editable && (
                <button type="button" className="icon-btn" aria-label={`Take back ${item?.item || 'item'}`} onClick={() => onRemove(o.id)}>
                  <Icon name="close" />
                </button>
              )}
            </li>
          )
        })}
      </ol>
      <div className="trade-offer__coins">
        <span className="game-window__coin" aria-hidden="true" />
        {editable ? (
          <input
            className="game-window__purse"
            inputMode="decimal"
            aria-label="Coins you offer, in gold"
            value={coinDraft ?? (coins ? String(coins / 1000) : '0')}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setCoinDraft(e.target.value)}
            onBlur={() => {
              if (coinDraft != null) onCoins(Math.min(goldToCopper(coinDraft), purse))
              setCoinDraft(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <span className="game-window__purse">{formatCoins(coins)}</span>
        )}
      </div>
      {editable && <span className="trade-offer__hint">Coins in gold · you have {formatCoins(purse)}</span>}
    </section>
  )
}

// The trade window: both characters on stage with Trade / Cancel between
// them, each side's offer below, and a chat on the right.
function TradeWindow({ trade, playerId, loot, wallet, tradesTable, onClose }) {
  const { tables } = useCampaignData()
  const party = tables.character?.items || []
  const { me, them } = sides(trade, playerId)
  const memberFor = (holder) => party.find((m) => ownerKey(m.name) === ownerKey(holder))
  const [picking, setPicking] = useState(false)
  const [chat, setChat] = useState('')
  const [error, setError] = useState(null)
  const logRef = useRef(null)
  const purse = wallet ? totalValue(wallet) : 0
  const open = trade.status === 'open' || trade.status === 'invite'
  const finished = !open && trade.status !== 'executing'

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [trade.messages.length])

  // Both pressed Trade: run the swap (only one screen actually does).
  useEffect(() => {
    if (trade.status !== 'open' || !trade.fromReady || !trade.toReady) return
    executeTrade(trade.id).catch((err) => setError(err.message))
  }, [trade.status, trade.fromReady, trade.toReady, trade.id])

  async function patch(values) {
    setError(null)
    try {
      await tradesTable.updateItem(trade.id, values)
    } catch (err) {
      setError(/trades/.test(err.message) ? 'Run the latest supabase/schema.sql first (it adds trades).' : err.message)
    }
  }

  const setOffer = (offer) => patch(offerPatch(me.key, { offer }))
  const say = (text, system = false) =>
    patch({ messages: [...trade.messages, { player: playerId, name: me.holder, text, system, at: new Date().toISOString() }].slice(-100) })

  async function setSprite(file) {
    const member = memberFor(me.holder)
    if (!member) return
    try {
      const path = await uploadImage('party-portraits', file)
      const { error: saveError } = await supabase.from('party_members').update({ sprite_path: path }).eq('id', member.id)
      if (saveError) throw new Error(/sprite_path/.test(saveError.message) ? 'Run the latest supabase/schema.sql first (it adds sprites).' : saveError.message)
      if (member.sprite_path) await removeImage('party-portraits', member.sprite_path)
      tables.character.refetch?.({ silent: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const status =
    trade.status === 'invite'
      ? `Waiting for ${them.holder} to join…`
      : trade.status === 'executing'
        ? 'Trading…'
        : trade.status === 'done'
          ? 'Trade complete!'
          : trade.status === 'declined'
            ? `${them.holder} declined.`
            : trade.status === 'cancelled'
              ? 'This trade was cancelled.'
              : me.ready && them.ready
                ? 'Trading…'
                : me.ready
                  ? `Waiting for ${them.holder} to press Trade…`
                  : them.ready
                    ? `${them.holder} is ready. Press Trade to finish.`
                    : 'Add items or coins, then both press Trade.'

  return (
    <Modal onClose={onClose} label={`Trade with ${them.holder}`} size="trade">
      <div className="trade">
        <section className="game-window trade__main">
          <header className="game-window__title">
            <span>Item trade</span>
            <span className="game-window__owner">with {them.holder}</span>
          </header>
          <p className={`trade__status${trade.status === 'done' ? ' is-done' : ''}`} role="status">
            {status}
          </p>
          <div className="trade__stages">
            <SpriteStage member={memberFor(me.holder)} holder={me.holder} ready={me.ready} mine onSprite={setSprite} />
            <div className="trade__buttons">
              {open ? (
                <>
                  <button
                    type="button"
                    className="trade__btn trade__btn--trade"
                    disabled={trade.status !== 'open' || me.ready}
                    onClick={() => patch({ [`${me.key}_ready`]: true })}
                  >
                    {me.ready ? 'Ready' : 'Trade'}
                  </button>
                  <button
                    type="button"
                    className="trade__btn trade__btn--cancel"
                    onClick={async () => {
                      await patch({ status: 'cancelled' })
                      onClose()
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className="trade__btn trade__btn--trade" onClick={onClose}>
                  {finished ? 'Close' : '…'}
                </button>
              )}
            </div>
            <SpriteStage member={memberFor(them.holder)} holder={them.holder} ready={them.ready} />
          </div>
          <div className="trade__offers">
            <OfferColumn
              label="Your offer"
              offer={me.offer}
              coins={me.coins}
              loot={loot}
              editable={open}
              purse={purse}
              onAdd={() => setPicking(true)}
              onRemove={(id) => setOffer(me.offer.filter((o) => o.id !== id))}
              onCoins={(coins) => patch(offerPatch(me.key, { coins }))}
              settled={trade.status === 'done'}
            />
            <OfferColumn
              label={`${them.holder}’s offer`}
              offer={them.offer}
              coins={them.coins}
              loot={loot}
              editable={false}
              purse={0}
              settled={trade.status === 'done'}
            />
          </div>
          {error && <p className="field-error">{error}</p>}
        </section>

        <aside className="trade__side">
          <section className="game-window trade__chat" aria-label="Trade chat">
            <ol className="trade__log" ref={logRef}>
              {trade.messages.length === 0 && <li className="trade__log-empty">Say hello, or haggle.</li>}
              {trade.messages.map((m, i) => (
                <li key={i} className={m.system ? 'trade__log-system' : m.player === playerId ? 'is-mine' : ''}>
                  {!m.system && <strong>{m.name}: </strong>}
                  {m.text}
                </li>
              ))}
            </ol>
            <form
              className="trade__say"
              onSubmit={(e) => {
                e.preventDefault()
                if (chat.trim()) say(chat.trim())
                setChat('')
              }}
            >
              <input value={chat} onChange={(e) => setChat(e.target.value)} aria-label="Message" maxLength={200} disabled={finished} />
              <button type="submit" className="trade__btn trade__btn--enter" disabled={finished}>
                Enter
              </button>
            </form>
          </section>
          <div className="trade__rules">
            <p>
              <Icon name="alert" /> Trades are final once both players press Trade.
            </p>
            <p>Changing either offer cancels both presses, so nobody accepts a deal that changed.</p>
          </div>
        </aside>
      </div>

      {picking && (
        <OfferPicker
          loot={loot.filter((l) => ownerKey(l.holder) === ownerKey(me.holder) && !me.offer.some((o) => o.id === l.id))}
          holder={me.holder}
          onClose={() => setPicking(false)}
          onPick={(id, qty) => {
            setOffer([...me.offer, { id, qty }].slice(0, MAX_OFFER))
            setPicking(false)
          }}
        />
      )}
    </Modal>
  )
}

function OfferPicker({ loot, holder, onClose, onPick }) {
  const [chosen, setChosen] = useState(null)
  const [qty, setQty] = useState(1)
  const item = loot.find((l) => l.id === chosen)
  return (
    <Modal onClose={onClose} label="Offer an item" size="narrow">
      <div className="form-stack">
        <h3 className="section-card__title">
          <Icon name="backpack" /> Offer from {holder}
        </h3>
        {loot.length === 0 ? (
          <p className="inline-state">Nothing left to offer.</p>
        ) : (
          <ol className="inventory__grid trade-picker">
            {loot.map((l) => (
              <li key={l.id} className={`inv-slot${l.id === chosen ? ' is-selected' : ''}`}>
                <button
                  type="button"
                  className="inv-slot__button"
                  onClick={() => {
                    setChosen(l.id)
                    setQty(l.quantity ?? 1)
                  }}
                  aria-label={`${l.item}${l.quantity !== null ? `, ${l.quantity}` : ''}`}
                >
                  <ItemIcon entry={l} />
                  {l.quantity !== null && <span className="inv-slot__qty">{l.quantity}</span>}
                </button>
              </li>
            ))}
          </ol>
        )}
        {item && (
          <div className="trade-picker__chosen">
            <strong>{item.item}</strong>
            {item.quantity !== null && item.quantity > 1 && (
              <label className="shop__qty">
                How many
                <input type="number" min="1" max={item.quantity} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(item.quantity, Math.floor(Number(e.target.value) || 1))))} />
              </label>
            )}
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={!item} onClick={() => onPick(item.id, item.quantity === null ? 1 : qty)}>
            Offer it
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default TradeWindow
