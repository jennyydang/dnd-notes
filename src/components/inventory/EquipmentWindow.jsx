import { useState } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { getPublicUrl } from '../../lib/storage.js'
import { STASH, bagOf, ownerKey } from '../../lib/inventory.js'
import { EQUIP_SLOTS, guessSlotKind } from '../../lib/equipment.js'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import ItemIcon from './ItemIcon.jsx'

const kindOf = (slotId) => (slotId.startsWith('ring') ? 'ring' : slotId)

// MapleStory-style equipment window: the character in the middle with
// their gear slots either side. Drop gear on a slot (or tap an empty slot
// to pick some); drag it back to the bag to take it off.
function EquipmentWindow({ owner, worn, bagItems, selectedId, dragged, onSelect, onDragStart, onDragEnd, onEquip }) {
  const { tables } = useCampaignData()
  const member = (tables.character?.items || []).find((m) => ownerKey(m.name) === owner.key)
  const sprite = member?.sprite_path ? getPublicUrl('party-portraits', member.sprite_path) : ''
  const portrait = member?.photo_path ? getPublicUrl('party-portraits', member.photo_path) : ''
  const [picking, setPicking] = useState(null) // slot id

  if (owner.key === STASH) {
    return (
      <section className="game-window equipment equipment--stash" aria-label="Equipment">
        <header className="game-window__title">
          <span>Equipment</span>
        </header>
        <p className="equipment__none">The party stash doesn’t wear anything. Pick a character to see their gear.</p>
      </section>
    )
  }

  const slot = (s) => {
    const item = worn[s.id]
    const fits = dragged && guessSlotKind(dragged) === kindOf(s.id)
    return (
      <li key={s.id} className="equipment__slot" style={{ gridArea: s.id }}>
        <div
          className={`inv-slot${item ? '' : ' inv-slot--empty'}${item?.id === selectedId ? ' is-selected' : ''}${
            dragged && item?.id !== dragged.id ? (fits ? ' is-target' : ' is-drop') : ''
          }`}
          onDragOver={(e) => dragged && e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (dragged && dragged.id !== item?.id) onEquip(dragged, s.id)
          }}
        >
          <button
            type="button"
            className="inv-slot__button"
            draggable={Boolean(item)}
            onDragStart={() => item && onDragStart(item.id)}
            onDragEnd={onDragEnd}
            onClick={() => (item ? onSelect(item.id) : setPicking(s.id))}
            aria-label={item ? `${s.label}: ${item.item}` : `${s.label}: empty. Choose something to wear`}
          >
            {item ? <ItemIcon entry={item} bag="equip" /> : <Icon name={s.icon} />}
          </button>
        </div>
        <span className="equipment__label">{s.label}</span>
      </li>
    )
  }

  const wornCount = Object.keys(worn).length
  return (
    <section className="game-window equipment" aria-label={`${owner.label}’s equipment`}>
      <header className="game-window__title">
        <span>Equipment</span>
        <span className="game-window__owner">{wornCount} worn</span>
      </header>
      <ol className="equipment__board">
        {EQUIP_SLOTS.map(slot)}
        <li className="equipment__figure" aria-hidden="true">
          {sprite ? (
            <img className="equipment__sprite" src={sprite} alt="" />
          ) : portrait ? (
            <img className="equipment__portrait" src={portrait} alt="" />
          ) : (
            <Icon name="user" size="4rem" />
          )}
          <span className="equipment__name">{owner.label}</span>
        </li>
      </ol>

      {picking && (
        <EquipPicker
          slotId={picking}
          items={bagItems.filter((l) => bagOf(l) === 'equip')}
          onClose={() => setPicking(null)}
          onPick={(item) => {
            onEquip(item, picking)
            setPicking(null)
          }}
        />
      )}
    </section>
  )
}

function EquipPicker({ slotId, items, onClose, onPick }) {
  const label = EQUIP_SLOTS.find((s) => s.id === slotId)?.label
  // Things that go in this slot first.
  const sorted = [...items].sort((a, b) => (guessSlotKind(b) === kindOf(slotId)) - (guessSlotKind(a) === kindOf(slotId)))
  return (
    <Modal onClose={onClose} label={`Wear on ${label}`} size="narrow">
      <div className="form-stack">
        <h3 className="section-card__title">
          <Icon name="shield" /> {label}
        </h3>
        {sorted.length === 0 ? (
          <p className="inline-state">Nothing in the Equip bag to wear.</p>
        ) : (
          <ul className="equip-picker">
            {sorted.map((item) => (
              <li key={item.id}>
                <button type="button" className="shop__row" onClick={() => onPick(item)}>
                  <span className="inv-slot shop__icon">
                    <ItemIcon entry={item} bag="equip" />
                  </span>
                  <span className="shop__row-text">
                    <span className="shop__item">{item.item}</span>
                    {guessSlotKind(item) === kindOf(slotId) && <span className="shop__meta">Fits here</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default EquipmentWindow
