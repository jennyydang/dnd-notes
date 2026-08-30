import { useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl, uploadImage } from '../lib/storage.js'
import { listCampaignMembers } from '../lib/campaigns.js'
import PartyGoals from './PartyGoals.jsx'
import './PartyTab.scss'

const BUCKET = 'party-portraits'
const MEMBER_TYPES = ['Player', 'NPC']

// Used to keep the party_notes useSupabaseTable filter valid (a real,
// well-formed UUID that will never match a real player) when there's no
// logged-in player (the admin view) — claiming and private notes don't
// apply there, so this just makes the hook return zero rows.
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

const emptyForm = {
  name: '',
  memberType: 'Player',
  playerName: '',
  raceClass: '',
  level: 1,
  animalCompanion: '',
  notes: '',
  photoFile: null,
  photoPreview: '',
  photoRemoved: false,
}

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  memberType: r.member_type,
  playerName: r.player_name,
  raceClass: r.race_class,
  level: r.level,
  animalCompanion: r.animal_companion,
  notes: r.notes,
  photo: getPublicUrl(BUCKET, r.photo_path),
  claimedBy: r.claimed_by,
})

const fromNoteRow = (r) => ({
  id: r.id,
  partyMemberId: r.party_member_id,
  notes: r.notes,
})

function PartyTab({ campaignId, playerId }) {
  const { items: party, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('party_members', { fromRow, filters: { campaign_id: campaignId } })
  const {
    items: privateNotes,
    addItem: addPrivateNote,
    updateItem: updatePrivateNote,
  } = useSupabaseTable('party_notes', {
    fromRow: fromNoteRow,
    filters: { author_player_id: playerId || ZERO_UUID },
  })
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [claimError, setClaimError] = useState(null)
  const [usernames, setUsernames] = useState({})
  const [expandedNoteIds, setExpandedNoteIds] = useState(() => new Set())
  const [noteDrafts, setNoteDrafts] = useState({})
  const [noteErrors, setNoteErrors] = useState({})
  const photoInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    listCampaignMembers(campaignId)
      .then((members) => {
        if (cancelled) return
        const map = {}
        for (const member of members) map[member.playerId] = member.username
        setUsernames(map)
      })
      .catch(() => {
        // Non-critical: worst case "Claimed by {username}" falls back to
        // not showing a username. Claiming itself still works.
      })
    return () => {
      cancelled = true
    }
  }, [campaignId])

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

  function startAdding() {
    revokeTrackedObjectUrl()
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setIsAdding(true)
  }

  function startEditing(member) {
    revokeTrackedObjectUrl()
    setForm({
      name: member.name,
      memberType: member.memberType,
      playerName: member.playerName,
      raceClass: member.raceClass,
      level: member.level,
      animalCompanion: member.animalCompanion,
      notes: member.notes,
      photoFile: null,
      photoPreview: member.photo || '',
      photoRemoved: false,
    })
    setIsAdding(false)
    setFormError(null)
    setEditingId(member.id)
  }

  function cancelForm() {
    revokeTrackedObjectUrl()
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  function handlePhotoSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

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

  async function submitForm(event) {
    event.preventDefault()
    if (!form.name.trim()) return

    const payload = {
      name: form.name,
      member_type: form.memberType,
      player_name: form.memberType === 'Player' ? form.playerName : '',
      race_class: form.raceClass,
      level: Math.min(20, Math.max(1, Math.floor(Number(form.level)) || 1)),
      animal_companion: form.animalCompanion,
      notes: form.notes,
    }

    try {
      if (form.photoFile) {
        payload.photo_path = await uploadImage(BUCKET, form.photoFile)
      } else if (form.photoRemoved) {
        payload.photo_path = null
      }

      if (editingId) {
        await updateItem(editingId, payload)
      } else {
        await addItem(payload)
      }
      cancelForm()
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function removeMember(id) {
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  async function claimMember(memberId) {
    setClaimError(null)
    try {
      await updateItem(memberId, { claimed_by: playerId })
    } catch {
      setClaimError('You’ve already claimed a character in this campaign.')
    }
  }

  async function unclaimMember(memberId) {
    setClaimError(null)
    try {
      await updateItem(memberId, { claimed_by: null })
    } catch (err) {
      setClaimError(err.message)
    }
  }

  function toggleNoteExpanded(memberId) {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
        const existing = privateNotes.find((note) => note.partyMemberId === memberId)
        setNoteDrafts((drafts) => ({ ...drafts, [memberId]: existing?.notes || '' }))
      }
      return next
    })
  }

  async function savePrivateNote(memberId) {
    const text = noteDrafts[memberId] ?? ''
    const existing = privateNotes.find((note) => note.partyMemberId === memberId)
    try {
      if (existing) {
        await updatePrivateNote(existing.id, { notes: text })
      } else {
        await addPrivateNote({ party_member_id: memberId, notes: text })
      }
      setNoteErrors((prev) => ({ ...prev, [memberId]: null }))
      // Collapsing the editor is the visible "it worked" signal — with no
      // error, there's otherwise no feedback that anything happened at all.
      setExpandedNoteIds((prev) => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
    } catch (err) {
      setNoteErrors((prev) => ({ ...prev, [memberId]: err.message }))
    }
  }

  const showForm = isAdding || editingId !== null
  const myClaimedMemberId = party.find((m) => m.claimedBy === playerId)?.id

  return (
    <section className="party-tab">
      <PartyGoals campaignId={campaignId} />

      <h3 className="party-tab__section-title">Party Members</h3>
      <div className="party-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Party Member
        </button>
      </div>

      {claimError && <p className="empty-state empty-state--error">{claimError}</p>}

      {showForm && (
        <form className="party-form panel" onSubmit={submitForm}>
          <div className="party-form__layout">
            <div className="party-form__photo">
              <button
                type="button"
                className="party-form__photo-btn"
                onClick={() => photoInputRef.current?.click()}
                aria-label="Choose a portrait photo"
              >
                {form.photoPreview ? (
                  <img src={form.photoPreview} alt="Party member portrait" />
                ) : (
                  <span className="party-form__photo-placeholder">+ Photo</span>
                )}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handlePhotoSelected}
              />
              {form.photoPreview && (
                <button type="button" className="btn btn--text" onClick={removePhoto}>
                  Remove photo
                </button>
              )}
            </div>

            <div className="party-form__grid">
              <div className="field">
                <label htmlFor="party-name">Name</label>
                <input
                  id="party-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Kaelen Ashwood"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="party-type">Type</label>
                <select
                  id="party-type"
                  value={form.memberType}
                  onChange={(e) => setForm({ ...form, memberType: e.target.value })}
                >
                  {MEMBER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              {form.memberType === 'Player' && (
                <div className="field">
                  <label htmlFor="party-player-name">Player&rsquo;s real name</label>
                  <input
                    id="party-player-name"
                    type="text"
                    value={form.playerName}
                    onChange={(e) => setForm({ ...form, playerName: e.target.value })}
                    placeholder="Jenny"
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="party-race-class">Race / Class</label>
                <input
                  id="party-race-class"
                  type="text"
                  value={form.raceClass}
                  onChange={(e) => setForm({ ...form, raceClass: e.target.value })}
                  placeholder="Half-elf Ranger"
                />
              </div>
              <div className="field">
                <label htmlFor="party-level">Level</label>
                <input
                  id="party-level"
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="party-animal-companion">Animal Companion</label>
                <input
                  id="party-animal-companion"
                  type="text"
                  value={form.animalCompanion}
                  onChange={(e) => setForm({ ...form, animalCompanion: e.target.value })}
                  placeholder="Fang, a dire wolf"
                />
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="party-notes">Notes</label>
            <textarea
              id="party-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Joined the party after the battle at Redstone Bridge..."
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="party-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Party Member'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && party.length === 0 && (
        <p className="empty-state">
          No party members recorded yet. Add the players and NPC companions
          adventuring together.
        </p>
      )}

      {!loading && !error && party.length > 0 && (
        <div className="party-list">
          {party.map((member) => (
            <article className="party-card panel" key={member.id}>
              <div className="party-card__main">
                <div className="party-card__identity">
                  <div className="party-card__avatar">
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} />
                    ) : (
                      <span>{member.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <h3 className="party-card__name">{member.name}</h3>
                </div>
                <span
                  className={`status-badge status-badge--${member.memberType.toLowerCase()}`}
                >
                  {member.memberType}
                </span>
              </div>
              <dl className="party-card__details">
                <div>
                  <dt>Race / Class</dt>
                  <dd>{member.raceClass || '—'}</dd>
                </div>
                <div>
                  <dt>Level</dt>
                  <dd>{member.level}</dd>
                </div>
                {member.animalCompanion && (
                  <div>
                    <dt>Animal Companion</dt>
                    <dd>{member.animalCompanion}</dd>
                  </div>
                )}
                {member.memberType === 'Player' && (
                  <div>
                    <dt>Played by</dt>
                    <dd>{member.playerName || '—'}</dd>
                  </div>
                )}
              </dl>
              {member.notes && <p className="party-card__notes">{member.notes}</p>}
              {member.memberType === 'Player' && playerId && (
                <div className="party-card__claim">
                  {member.claimedBy === playerId ? (
                    <>
                      <span className="party-card__claim-badge party-card__claim-badge--you">
                        Claimed by you
                      </span>
                      <button
                        type="button"
                        className="btn btn--text"
                        onClick={() => unclaimMember(member.id)}
                      >
                        Unclaim
                      </button>
                    </>
                  ) : member.claimedBy ? (
                    <span className="party-card__claim-badge">
                      Claimed by {usernames[member.claimedBy] || 'another player'}
                    </span>
                  ) : (
                    !myClaimedMemberId && (
                      <button
                        type="button"
                        className="btn btn--text"
                        onClick={() => claimMember(member.id)}
                      >
                        Claim this character
                      </button>
                    )
                  )}
                </div>
              )}
              {member.memberType === 'Player' && playerId && member.claimedBy !== playerId && (
                <div className="party-card__private-notes">
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => toggleNoteExpanded(member.id)}
                  >
                    {expandedNoteIds.has(member.id) ? 'Hide private note' : 'Private note'}
                  </button>
                  {expandedNoteIds.has(member.id) && (
                    <div className="party-card__private-notes-editor">
                      <textarea
                        value={noteDrafts[member.id] ?? ''}
                        onChange={(e) =>
                          setNoteDrafts((drafts) => ({ ...drafts, [member.id]: e.target.value }))
                        }
                        placeholder="Only you can see this note..."
                      />
                      {noteErrors[member.id] && (
                        <p className="empty-state empty-state--error">{noteErrors[member.id]}</p>
                      )}
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => savePrivateNote(member.id)}
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="party-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => startEditing(member)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => removeMember(member.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default PartyTab
