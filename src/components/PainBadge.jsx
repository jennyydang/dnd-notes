import { painLabel, regionLabel } from '../lib/injuries.js'
import './PainBadge.scss'

function PainBadge({ injury }) {
  const title = `${regionLabel(injury.region)}: ${painLabel(injury.pain)}${injury.note ? ` — ${injury.note}` : ''}`
  return (
    <span className={`pain-badge pain-badge--pain-${injury.pain}`} title={title}>
      <span className="pain-badge__level" aria-label={`Pain ${injury.pain} of 5, ${painLabel(injury.pain)}`}>
        {injury.pain}
      </span>
      {regionLabel(injury.region)}
    </span>
  )
}

export default PainBadge
