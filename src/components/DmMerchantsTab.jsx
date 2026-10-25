import { useState } from 'react'
import { useCampaignData } from '../hooks/useCampaignData.js'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { useImageCrop } from '../hooks/useImageCrop.jsx'
import { getPublicUrl, removeImage, uploadImage } from '../lib/storage.js'
import { listCampaignMembers } from '../lib/campaigns.js'
import { notifyPlayer } from '../lib/notifications.js'
import { formatCoins, goldToCopper } from '../lib/currency.js'
import { BAGS, bagOf, stacks } from '../lib/inventory.js'
import { confirmDelete } from '../lib/confirm.js'
import { merchantFromRow, stockFromRow } from './inventory/ShopWindow.jsx'
import ItemIcon from './inventory/ItemIcon.jsx'
import DmPrivacyNote from './DmPrivacyNote.jsx'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import './inventory/Inventory.scss'
import './DmMerchantsTab.scss'

const SCHEMA_HINT = 'Run the latest supabase/schema.sql first (it adds merchants).'
const friendly = (err) => (/merchant/.test(err.message) && /relation|schema|does not exist/.test(err.message) ? SCHEMA_HINT : err.message)

const emptyMerchant = { name: '', greeting: '', sellRate: 50, photoFile: null, photoPreview: '', photoRemoved: false }
const emptyWare = { item: '', bag: 'use', price: '', stock: '', notes: '', usable: true, photoFile: null, photoPreview: '', photoRemoved: false }

// DM → Merchants: shops the party can visit. Stock them with prices; while
// a shop is open, players see it on their inventory and can buy (paying
// from their wallet) and sell back what they bought.
function DmMerchantsTab() {
  const { campaignId } = useCampaignData()
  const merchants = useSupabaseTable('merchants', { fromRow: merchantFromRow, filters: { campaign_id: campaignId } })
  const stock = useSupabaseTable('merchant_items', { fromRow: stockFromRow, filters: { campaign_id: campaignId } })
  const [editing, setEditing] = useState(null) // { id|null, form }
  const [wareEditing, setWareEditing] = useState(null) // { merchantId, id|null, form }
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  async function toggleOpen(m) {
    setError(null)
    setNotice(null)
    try {
      await merchants.updateItem(m.id, { is_open: !m.isOpen })
      if (!m.isOpen) {
        const players = (await listCampaignMembers(campaignId).catch(() => [])).filter((p) => p.role !== 'dm')
        await Promise.all(
          players.map((p) =>
            notifyPlayer(p.playerId, {
              kind: 'shop_open',
              title: `${m.name} is open for business`,
              body: m.greeting || 'Visit the shop from your inventory (Loot tab).',
            }).catch(() => {}),
          ),
        )
        setNotice(`${m.name} is open. Players were notified.`)
      }
    } catch (err) {
      setError(friendly(err))
    }
  }

  async function removeMerchant(m) {
    if (!confirmDelete(`the merchant “${m.name}” and everything they sell`)) return
    try {
      await merchants.removeItem(m.id)
      if (m.photoPath) await removeImage('npc-portraits', m.photoPath)
      for (const w of stock.items.filter((s) => s.merchantId === m.id)) if (w.photoPath) await removeImage('loot-photos', w.photoPath)
    } catch (err) {
      setError(friendly(err))
    }
  }

  async function removeWare(w) {
    if (!confirmDelete(`“${w.item}” from the shop`)) return
    try {
      await stock.removeItem(w.id)
      if (w.photoPath) await removeImage('loot-photos', w.photoPath)
    } catch (err) {
      setError(friendly(err))
    }
  }

  return (
    <section className="dm-merchants">
      <DmPrivacyNote />
      <p className="dm-merchants__summary">Players only see a shop while it’s open. Open one when the party walks in.</p>
      <div className="dm-merchants__toolbar">
        <p className="dm-merchants__summary">
          {merchants.loading ? 'Loading…' : `${merchants.items.length} merchant${merchants.items.length === 1 ? '' : 's'}`}
        </p>
        <button type="button" className="btn btn--primary" onClick={() => setEditing({ id: null, form: emptyMerchant })}>
          <Icon name="plus" /> New merchant
        </button>
      </div>
      {(error || merchants.error) && <p className="field-error">{error || friendly(merchants.error)}</p>}
      {notice && <p className="dm-merchants__notice">{notice}</p>}

      {!merchants.loading && merchants.items.length === 0 && (
        <p className="empty-state">No merchants yet. Make a blacksmith, an apothecary or a shady fence, stock their shelves, and open shop.</p>
      )}

      <ul className="dm-merchants__list">
        {merchants.items.map((m) => {
          const wares = stock.items.filter((w) => w.merchantId === m.id)
          return (
            <li key={m.id} className={`game-window dm-merchant${m.isOpen ? ' is-open' : ''}`}>
              <header className="dm-merchant__head">
                <span className="shop__face" aria-hidden="true">
                  {m.photo ? <img src={m.photo} alt="" /> : <Icon name="coins" />}
                </span>
                <div className="dm-merchant__who">
                  <h3 className="dm-merchant__name">{m.name}</h3>
                  <p className="dm-merchant__meta">
                    <span className={`dm-merchant__state${m.isOpen ? ' is-open' : ''}`}>{m.isOpen ? 'Open' : 'Closed'}</span> · buys back at{' '}
                    {Math.round(m.sellRate * 100)}% · {wares.length} item{wares.length === 1 ? '' : 's'}
                  </p>
                  {m.greeting && <p className="dm-merchant__greeting">“{m.greeting}”</p>}
                </div>
              </header>
              <div className="dm-merchant__actions">
                <button type="button" className={`btn${m.isOpen ? '' : ' btn--primary'}`} onClick={() => toggleOpen(m)}>
                  <Icon name={m.isOpen ? 'lock' : 'coins'} /> {m.isOpen ? 'Close shop' : 'Open shop'}
                </button>
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() =>
                    setEditing({
                      id: m.id,
                      current: m,
                      form: { ...emptyMerchant, name: m.name, greeting: m.greeting, sellRate: Math.round(m.sellRate * 100), photoPreview: m.photo },
                    })
                  }
                >
                  <Icon name="edit" /> Edit
                </button>
                <button type="button" className="btn btn--text dm-merchant__delete" onClick={() => removeMerchant(m)}>
                  <Icon name="trash" /> Delete
                </button>
              </div>

              <ul className="shop__list dm-merchant__stock">
                {wares.length === 0 && <li className="shop__empty">Nothing on the shelves yet.</li>}
                {wares.map((w) => (
                  <li key={w.id} className="dm-merchant__ware">
                    <span className="inv-slot shop__icon">
                      <ItemIcon entry={w} bag={w.bag || bagOf(w)} />
                    </span>
                    <span className="shop__row-text">
                      <span className="shop__item">{w.item}</span>
                      <span className="shop__meta">
                        {BAGS.find((b) => b.id === (w.bag || bagOf(w)))?.label} · {w.stock === null ? 'Unlimited' : `${w.stock} in stock`}
                      </span>
                    </span>
                    <span className="shop__price">{formatCoins(w.priceCp)}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Edit ${w.item}`}
                      onClick={() =>
                        setWareEditing({
                          merchantId: m.id,
                          id: w.id,
                          current: w,
                          form: {
                            ...emptyWare,
                            item: w.item,
                            bag: w.bag || bagOf(w),
                            price: String(w.priceCp / 1000),
                            stock: w.stock === null ? '' : String(w.stock),
                            notes: w.notes,
                            usable: w.usable,
                            photoPreview: w.photo,
                          },
                        })
                      }
                    >
                      <Icon name="edit" />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Remove ${w.item}`} onClick={() => removeWare(w)}>
                      <Icon name="trash" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn--text dm-merchant__add" onClick={() => setWareEditing({ merchantId: m.id, id: null, form: emptyWare })}>
                <Icon name="plus" /> Add item for sale
              </button>
            </li>
          )
        })}
      </ul>

      {editing && (
        <MerchantForm
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            if (editing.id) await merchants.updateItem(editing.id, payload)
            else await merchants.addItem(payload)
            setEditing(null)
          }}
        />
      )}
      {wareEditing && (
        <WareForm
          editing={wareEditing}
          onClose={() => setWareEditing(null)}
          onSave={async (payload) => {
            if (wareEditing.id) await stock.updateItem(wareEditing.id, payload)
            else await stock.addItem({ ...payload, merchant_id: wareEditing.merchantId })
            setWareEditing(null)
          }}
        />
      )}
    </section>
  )
}

// Shared photo handling for both forms: crop on pick, upload on save.
async function savePhoto(form, current, bucket) {
  if (form.photoFile) {
    const path = await uploadImage(bucket, form.photoFile)
    if (current?.photoPath) await removeImage(bucket, current.photoPath)
    return { photo_path: path }
  }
  if (form.photoRemoved && current?.photoPath) {
    await removeImage(bucket, current.photoPath)
    return { photo_path: null }
  }
  return {}
}

function PhotoField({ form, setForm, shape, label }) {
  const crop = useImageCrop({
    aspect: 1,
    shape,
    onCropped: (file) => setForm((f) => ({ ...f, photoFile: file, photoPreview: URL.createObjectURL(file), photoRemoved: false })),
    onRemove: () => setForm((f) => ({ ...f, photoFile: null, photoPreview: '', photoRemoved: true })),
  })
  return (
    <div className="field dm-merchants__photo">
      <span className="dm-merchants__photo-label">{label}</span>
      <div className="dm-merchants__photo-row">
        <span className="inv-slot shop__icon" aria-hidden="true">
          {form.photoPreview ? <img src={form.photoPreview} alt="" /> : <Icon name="image" />}
        </span>
        <label className="btn btn--text">
          <Icon name="upload" /> {form.photoPreview ? 'Change' : 'Add picture'}
          <input type="file" accept="image/*" hidden onChange={crop.fromInput} />
        </label>
        {form.photoPreview && (
          <button type="button" className="btn btn--text" onClick={() => crop.adjust(form.photoFile, form.photoPreview)}>
            Adjust
          </button>
        )}
      </div>
      {crop.dialog}
    </div>
  )
}

function MerchantForm({ editing, onClose, onSave }) {
  const [form, setForm] = useState(editing.form)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const photo = await savePhoto(form, editing.current, 'npc-portraits')
      await onSave({
        name: form.name.trim(),
        greeting: form.greeting.trim(),
        sell_rate: Math.max(0, Math.min(100, Number(form.sellRate) || 0)) / 100,
        ...photo,
      })
    } catch (err) {
      setError(friendly(err))
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} label={editing.id ? 'Edit merchant' : 'New merchant'} size="narrow">
      <form className="form-stack" onSubmit={submit}>
        <h3 className="section-card__title">
          <Icon name="coins" /> {editing.id ? 'Edit merchant' : 'New merchant'}
        </h3>
        <div className="field">
          <label htmlFor="merchant-name">Name</label>
          <input id="merchant-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bildrath’s Mercantile" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="merchant-greeting">Greeting</label>
          <textarea
            id="merchant-greeting"
            rows={2}
            value={form.greeting}
            onChange={(e) => setForm({ ...form, greeting: e.target.value })}
            placeholder="Prices are firm. Don’t touch the merchandise."
          />
        </div>
        <div className="field">
          <label htmlFor="merchant-rate">Buys items back at (% of their value)</label>
          <input id="merchant-rate" type="number" min="0" max="100" value={form.sellRate} onChange={(e) => setForm({ ...form, sellRate: e.target.value })} />
        </div>
        <PhotoField form={form} setForm={setForm} shape="rect" label="Portrait" />
        {error && <p className="field-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function WareForm({ editing, onClose, onSave }) {
  const [form, setForm] = useState(editing.form)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!form.item.trim()) return
    setSaving(true)
    setError(null)
    try {
      const photo = await savePhoto(form, editing.current, 'loot-photos')
      await onSave({
        item: form.item.trim(),
        bag: form.bag,
        notes: form.notes.trim(),
        usable: form.usable,
        price_cp: goldToCopper(form.price),
        stock: form.stock === '' ? null : Math.max(0, Math.floor(Number(form.stock) || 0)),
        ...photo,
      })
    } catch (err) {
      setError(friendly(err))
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} label={editing.id ? 'Edit item for sale' : 'Add item for sale'} size="narrow">
      <form className="form-stack" onSubmit={submit}>
        <h3 className="section-card__title">
          <Icon name="coins" /> {editing.id ? 'Edit item for sale' : 'Add item for sale'}
        </h3>
        <div className="field">
          <label htmlFor="ware-name">Item</label>
          <input id="ware-name" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="Potion of Healing" autoFocus />
        </div>
        <div className="dm-merchants__pair">
          <div className="field">
            <label htmlFor="ware-bag">Bag</label>
            <select id="ware-bag" value={form.bag} onChange={(e) => setForm({ ...form, bag: e.target.value, usable: e.target.value === 'use' })}>
              {BAGS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ware-price">Price (gold)</label>
            <input id="ware-price" type="number" min="0" step="0.001" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="50" />
          </div>
        </div>
        <p className="dm-merchants__hint">
          {form.price !== '' ? `Shows as ${formatCoins(goldToCopper(form.price))}. ` : ''}0.1 gold = 1 silver, 0.01 = 1 shilling.
        </p>
        <div className="field">
          <label htmlFor="ware-stock">How many in stock</label>
          <input id="ware-stock" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Leave blank for unlimited" />
        </div>
        <div className="field">
          <label htmlFor="ware-notes">Description</label>
          <textarea id="ware-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Heals 2d4+2 hit points." />
        </div>
        <label className="inventory__check">
          <input type="checkbox" checked={form.usable} onChange={(e) => setForm({ ...form, usable: e.target.checked })} /> Can be used up
          {stacks(form.bag) ? ' (stacks in the Use bag)' : ''}
        </label>
        <PhotoField form={form} setForm={setForm} shape="rect" label="Picture" />
        {error && <p className="field-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !form.item.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default DmMerchantsTab
