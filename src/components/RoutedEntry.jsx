import { useEffect } from 'react'
import { useCampaignData } from '../hooks/useCampaignData.js'
import EntityDetailModal from './EntityDetailModal.jsx'

// The entry named in the address (…/quests/quest/1a2b3c4d), shown over the
// current screen. Addresses carry the start of the id; it's matched once
// the campaign's entries have loaded, and an entry that's gone just closes.
function RoutedEntry({ entity: wanted, onClose }) {
  const { entities, loading } = useCampaignData()
  const found = wanted
    ? entities.find((e) => e.type === wanted.type && String(e.id).startsWith(wanted.ref)) || null
    : null

  useEffect(() => {
    if (wanted && !found && !loading) onClose({ replace: true })
  }, [wanted, found, loading, onClose])

  if (!found) return null
  return (
    <EntityDetailModal
      key={`${found.type}:${found.id}`}
      type={found.type}
      id={found.id}
      // Opened from another entry: back returns to that one.
      canGoBack={Boolean(window.history.state?.fromEntry)}
      onBack={() => window.history.back()}
      onClose={() => onClose()}
    />
  )
}

export default RoutedEntry
