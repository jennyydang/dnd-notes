import { matchKind, tagText } from '../lib/tags.js'

// The "#city" / "~faction" / "$magic-item" pill shown on a card, matching
// the tag it was (or could have been) created with from session notes.
// Renders nothing for a value that isn't one of the group's tag kinds.
function TagBadge({ group, kind }) {
  const matched = matchKind(group, kind)
  if (!matched) return null
  return <span className={`tag-badge tag-badge--${group}`}>{tagText(group, matched)}</span>
}

export default TagBadge
