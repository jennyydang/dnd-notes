import { useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl, uploadImage } from '../lib/storage.js'
import { supabase } from '../lib/supabaseClient.js'
import NewOrJoinCampaign from './NewOrJoinCampaign.jsx'
import ManageMembers from './ManageMembers.jsx'
import FeedbackForm from './FeedbackForm.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import AccountMenu from './AccountMenu.jsx'
import { NotificationBell } from './DmSharesInbox.jsx'
import Modal from './Modal.jsx'
import InviteBanner from './InviteBanner.jsx'
import './Dashboard.scss'
import CampaignSearch from './CampaignSearch.jsx'
import { matchesCampaign } from '../lib/search.js'
import { useImageCrop } from '../hooks/useImageCrop.jsx'

const BUCKET = 'campaign-covers'

const emptyForm = {
  name: '',
  description: '',
  photoFile: null,
  photoPreview: '',
  photoRemoved: false,
}

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  archived: r.archived,
  joinCode: r.join_code,
  cover: getPublicUrl(BUCKET, r.cover_image_path),
  role: r.role,
  createdBy: r.created_by,
})

function PlayerDashboard({ playerId, username, onOpenCampaign, onLogOut }) {
  const {
    items: campaigns,
    loading,
    error,
    refetch,
  } = useSupabaseTable('campaign_memberships', {
    fromRow,
    filters: { player_id: playerId },
  })
  const [showChooser, setShowChooser] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [managingMembersId, setManagingMembersId] = useState(null)
  const photoInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function revokeTrackedObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  function startEditing(campaign) {
    revokeTrackedObjectUrl()
    setForm({
      name: campaign.name,
      description: campaign.description,
      photoFile: null,
      photoPreview: campaign.cover || '',
      photoRemoved: false,
    })
    setFormError(null)
    setEditingId(campaign.id)
  }

  function cancelEditing() {
    revokeTrackedObjectUrl()
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  // Every picked photo goes through the crop/zoom/move step first.
  const photoCrop = useImageCrop({ aspect: 16 / 9, shape: 'rect', onCropped: applyPhoto })

  function applyPhoto(file) {

    revokeTrackedObjectUrl()
    const previewUrl = URL.createObjectURL(file)
    objectUrlRef.current = previewUrl
    setForm((prev) => ({
      ...prev,
      photoFile: file,
      photoPreview: previewUrl,
      photoRemoved: false,
    }))
  }

  function removePhoto() {
    revokeTrackedObjectUrl()
    setForm((prev) => ({ ...prev, photoFile: null, photoPreview: '', photoRemoved: true }))
  }

  async function submitEdit(event) {
    event.preventDefault()
    if (!form.name.trim()) return

    const patch = {
      name: form.name,
      description: form.description,
    }

    try {
      if (form.photoFile) {
        patch.cover_image_path = await uploadImage(BUCKET, form.photoFile)
      } else if (form.photoRemoved) {
        patch.cover_image_path = null
      }

      const { error: updateError } = await supabase
        .from('campaigns')
        .update(patch)
        .eq('id', editingId)
      if (updateError) throw new Error(updateError.message)

      await refetch()
      cancelEditing()
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function toggleArchived(campaign) {
    await supabase.from('campaigns').update({ archived: !campaign.archived }).eq('id', campaign.id)
    await refetch()
  }

  async function deleteCampaign(campaign) {
    const confirmed = window.confirm(
      `Delete "${campaign.name}" permanently? This removes everything in it — maps, NPCs, loot, quests, party, lore, and session notes. This can't be undone.`,
    )
    if (!confirmed) return
    await supabase.from('campaigns').delete().eq('id', campaign.id)
    if (editingId === campaign.id) cancelEditing()
    if (managingMembersId === campaign.id) setManagingMembersId(null)
    await refetch()
  }

  async function handleCampaignReady() {
    setShowChooser(false)
    await refetch()
  }

  function renderCampaignForm() {
    return (
      <form className="campaign-form panel" onSubmit={submitEdit}>
        <div className="campaign-form__layout">
          <div className="campaign-form__photo">
            <button
              type="button"
              className="campaign-form__photo-btn"
              onClick={() => photoInputRef.current?.click()}
              aria-label="Choose a cover photo"
            >
              {form.photoPreview ? (
                <img src={form.photoPreview} alt="Campaign cover" />
              ) : (
                <span className="campaign-form__photo-placeholder">+ Cover</span>
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={photoCrop.fromInput}
            />
            {form.photoPreview && (
              <>
                <button type="button" className="btn btn--text" onClick={() => photoCrop.adjust(form.photoFile, form.photoPreview)}>
                  Adjust
                </button>
                <button type="button" className="btn btn--text" onClick={removePhoto}>
                  Remove cover
                </button>
              </>
            )}
            {photoCrop.dialog}
          </div>

          <div className="campaign-form__fields">
            <div className="field">
              <label htmlFor="campaign-name">Name</label>
              <input
                id="campaign-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="campaign-description">Description</label>
              <textarea
                id="campaign-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
        </div>
        {formError && <p className="empty-state empty-state--error">{formError}</p>}
        <div className="campaign-form__actions">
          <button type="button" className="btn btn--text" onClick={cancelEditing}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save Changes
          </button>
        </div>
      </form>
    )
  }

  const [campaignQuery, setCampaignQuery] = useState('')
  const visibleCampaigns = campaigns
    .filter((c) => (showArchived ? c.archived : !c.archived))
    .filter((c) => matchesCampaign(c, campaignQuery))
  const archivedCount = campaigns.filter((c) => c.archived).length
  const managingMembersCampaign = campaigns.find((c) => c.id === managingMembersId)

  return (
    <section className="dashboard">
      <h2>Your Campaigns</h2>
      <div className="dashboard__toolbar">
        <div className="dashboard__toolbar-actions">
          <button
            type="button"
            className="btn btn--text"
            onClick={() => setShowArchived((prev) => !prev)}
          >
            {showArchived ? 'Show active campaigns' : `Show archived (${archivedCount})`}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setShowChooser(true)}>
            + Campaign
          </button>
        </div>
        <div className="dashboard__toolbar-account">
          <NotificationBell playerId={playerId} />
          <AccountMenu
            playerId={playerId}
            username={username}
            onOpenSettings={() => setShowSettings(true)}
            onSendFeedback={() => setShowFeedback(true)}
            onLogOut={onLogOut}
          />
        </div>
      </div>

      <InviteBanner playerId={playerId} onJoined={onOpenCampaign} />

      {showChooser && (
        <NewOrJoinCampaign
          playerId={playerId}
          onDone={handleCampaignReady}
          onCancel={() => setShowChooser(false)}
        />
      )}

      {showFeedback && (
        <Modal onClose={() => setShowFeedback(false)} label="Send Feedback">
          <FeedbackForm playerId={playerId} onDone={() => setShowFeedback(false)} />
        </Modal>
      )}

      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} label="Settings">
          <SettingsPanel onDone={() => setShowSettings(false)} />
        </Modal>
      )}

      {editingId && (
        <Modal onClose={cancelEditing} label="Edit Campaign">
          {renderCampaignForm()}
        </Modal>
      )}

      {managingMembersCampaign && (
        <ManageMembers
          campaignId={managingMembersCampaign.id}
          campaignName={managingMembersCampaign.name}
          joinCode={managingMembersCampaign.joinCode}
          createdBy={managingMembersCampaign.createdBy}
          onClose={() => setManagingMembersId(null)}
        />
      )}

      {campaigns.length > 1 && <CampaignSearch value={campaignQuery} onChange={setCampaignQuery} />}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && visibleCampaigns.length === 0 && (
        <p className="empty-state">
          {campaignQuery.trim()
            ? `No campaigns match “${campaignQuery.trim()}”.`
            : showArchived
            ? 'No archived campaigns.'
            : 'No campaigns yet. Create one or join one with a code to get started.'}
        </p>
      )}

      {!loading && !error && visibleCampaigns.length > 0 && (
        <div className="campaign-list">
          {visibleCampaigns.map((campaign) => (
            <article className="campaign-card panel" key={campaign.id}>
              <button
                type="button"
                className="campaign-card__open"
                onClick={() => onOpenCampaign(campaign)}
              >
                <div className="campaign-card__cover">
                  {campaign.cover ? (
                    <img src={campaign.cover} alt={campaign.name} />
                  ) : (
                    <span>{campaign.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="campaign-card__text">
                  <h3 className="campaign-card__name">
                    {campaign.name}
                    {campaign.joinCode && (
                      <span className="campaign-card__join-code">{campaign.joinCode}</span>
                    )}
                  </h3>
                  {campaign.description && (
                    <p className="campaign-card__description">{campaign.description}</p>
                  )}
                </div>
              </button>
              {(campaign.role === 'creator' || campaign.role === 'dm') && (
                <div className="campaign-card__actions">
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => startEditing(campaign)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => setManagingMembersId(campaign.id)}
                  >
                    Members
                  </button>
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => toggleArchived(campaign)}
                  >
                    {campaign.archived ? 'Unarchive' : 'Archive'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => deleteCampaign(campaign)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default PlayerDashboard
