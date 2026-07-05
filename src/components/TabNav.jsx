import './TabNav.scss'

function TabNav({ tabs, activeTab, onSelect }) {
  return (
    <nav className="tab-nav" role="tablist" aria-label="Campaign sections">
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
    </nav>
  )
}

export default TabNav
