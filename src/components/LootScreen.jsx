import { useState } from 'react'
import LootTab from './LootTab.jsx'
import InventoryWindow from './inventory/InventoryWindow.jsx'
import Icon from './Icon.jsx'
import './inventory/Inventory.scss'

const VIEW_KEY = 'dnd-notes-loot-view'

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'inventory'
  } catch {
    return 'inventory'
  }
}

// The Loot tab: the MapleStory-style inventory (each character's bags),
// or the original list of every item. Same items either way.
function LootScreen({ campaignId, playerId }) {
  const [view, setViewState] = useState(readView)
  function setView(next) {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // not remembered
    }
  }
  return (
    <div className="loot-screen">
      <div className="view-toggle loot-screen__switch" role="group" aria-label="Loot view">
        {[
          ['inventory', 'grid', 'Inventory'],
          ['list', 'rows', 'All loot'],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            className={`view-toggle__btn${view === id ? ' view-toggle__btn--active' : ''}`}
            onClick={() => setView(id)}
          >
            <Icon name={icon} /> <span className="view-toggle__label">{label}</span>
          </button>
        ))}
      </div>
      {view === 'inventory' ? <InventoryWindow campaignId={campaignId} playerId={playerId} /> : <LootTab campaignId={campaignId} />}
    </div>
  )
}

export default LootScreen
