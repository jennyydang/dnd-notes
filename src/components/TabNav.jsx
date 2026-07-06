import { useState } from 'react'
import './TabNav.scss'

function TabNav({ tabs, activeTab, onSelect, onAddTab }) {
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')

  function startAdding() {
    setName('')
    setIsAdding(true)
  }

  function submitAdd(event) {
    event.preventDefault()
    if (!name.trim()) return
    onAddTab(name)
    setIsAdding(false)
    setName('')
  }

  return (
    <nav className="tab-nav">
      <div className="tab-nav__list" role="tablist" aria-label="Campaign sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-nav__item${activeTab === tab.id ? ' tab-nav__item--active' : ''}`}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {onAddTab &&
        (isAdding ? (
          <form className="tab-nav__add-form" onSubmit={submitAdd}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tab name"
              aria-label="New tab name"
              autoFocus
            />
            <button type="submit" className="btn btn--primary">
              Add
            </button>
            <button
              type="button"
              className="btn btn--text"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="tab-nav__add"
            onClick={startAdding}
            aria-label="Add a new tab"
          >
            +
          </button>
        ))}
    </nav>
  )
}

export default TabNav
