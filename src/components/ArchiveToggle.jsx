import Icon from './Icon.jsx'
import './ArchiveToggle.scss'

// Switches a DM list between its active items and the ones archived after
// being revealed. Hidden until something has been archived.
function ArchiveToggle({ count, showing, onToggle }) {
  if (!count && !showing) return null
  return (
    <button
      type="button"
      className={`archive-toggle${showing ? ' is-on' : ''}`}
      aria-pressed={showing}
      onClick={onToggle}
    >
      <Icon name={showing ? 'prev' : 'archive'} /> {showing ? 'Back to active' : `Archived (${count})`}
    </button>
  )
}

export default ArchiveToggle
