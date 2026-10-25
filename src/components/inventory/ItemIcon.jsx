import { BAGS, bagOf } from '../../lib/inventory.js'
import Icon from '../Icon.jsx'

// An item's picture in a slot, or its bag's icon when it has none.
function ItemIcon({ entry, bag }) {
  if (entry.photo) return <img src={entry.photo} alt="" draggable={false} />
  return <Icon name={BAGS.find((b) => b.id === (bag || bagOf(entry)))?.icon || 'gem'} />
}

export default ItemIcon
