import { useCallback, useEffect, useState } from 'react'
import { listCampaignMembers } from '../lib/campaigns.js'
import { supabase } from '../lib/supabaseClient.js'
import './ManageMembers.scss'

function ManageMembers({ campaignId, campaignName, joinCode, onClose }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listCampaignMembers(campaignId)
      setMembers(data)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  async function removeMember(member) {
    const confirmed = window.confirm(`Remove ${member.username} from this campaign?`)
    if (!confirmed) return
    await supabase.from('campaign_members').delete().eq('id', member.membershipId)
    await loadMembers()
  }

  return (
    <section className="manage-members panel">
      <div className="manage-members__header">
        <h3>Members of {campaignName}</h3>
        <button type="button" className="btn btn--text" onClick={onClose}>
          Close
        </button>
      </div>

      {joinCode && (
        <p className="manage-members__code">
          Join code: <span>{joinCode}</span>
        </p>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && (
        <ul className="manage-members__list">
          {members.map((member) => (
            <li key={member.membershipId}>
              <span className="manage-members__username">{member.username}</span>
              <span className="manage-members__role">{member.role}</span>
              {member.role !== 'creator' && (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => removeMember(member)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ManageMembers
