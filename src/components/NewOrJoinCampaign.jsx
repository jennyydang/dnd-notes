import { useEffect, useRef, useState } from 'react'
import { createCampaign, joinCampaign } from '../lib/campaigns.js'
import { uploadImage } from '../lib/storage.js'
import './NewOrJoinCampaign.scss'

const BUCKET = 'campaign-covers'

function NewOrJoinCampaign({ playerId, onDone, onCancel }) {
  const [mode, setMode] = useState(null)

  if (!mode) {
    return (
      <div className="new-or-join panel">
        <h3>Add a Campaign</h3>
        <div className="new-or-join__choices">
          <button type="button" className="btn btn--primary" onClick={() => setMode('new')}>
            New Campaign
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setMode('existing')}>
            Join Existing
          </button>
          <button type="button" className="btn btn--text" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'new') {
    return <NewCampaignForm playerId={playerId} onDone={onDone} onBack={() => setMode(null)} />
  }

  return <JoinCampaignForm playerId={playerId} onDone={onDone} onBack={() => setMode(null)} />
}

function NewCampaignForm({ playerId, onDone, onBack }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)
  const photoInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function handlePhotoSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const previewUrl = URL.createObjectURL(file)
    objectUrlRef.current = previewUrl
    setPhotoFile(file)
    setPhotoPreview(previewUrl)
  }

  async function submit(event) {
    event.preventDefault()
    if (!name.trim()) return

    try {
      let coverImagePath
      if (photoFile) coverImagePath = await uploadImage(BUCKET, photoFile)

      const { joinCode } = await createCampaign(playerId, {
        name,
        description,
        coverImagePath,
      })
      setCreated({ joinCode })
    } catch (err) {
      setError(err.message)
    }
  }

  if (created) {
    return (
      <div className="new-or-join panel">
        <h3>Campaign created!</h3>
        <p>
          Share this code with your players so they can join:{' '}
          <span className="new-or-join__code">{created.joinCode}</span>
        </p>
        <div className="new-or-join__actions">
          <button type="button" className="btn btn--primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="new-or-join panel" onSubmit={submit}>
      <h3>New Campaign</h3>
      <div className="new-or-join__layout">
        <div className="new-or-join__photo">
          <button
            type="button"
            className="new-or-join__photo-btn"
            onClick={() => photoInputRef.current?.click()}
            aria-label="Choose a cover photo"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Campaign cover" />
            ) : (
              <span>+ Cover</span>
            )}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handlePhotoSelected}
          />
        </div>
        <div className="new-or-join__fields">
          <div className="field">
            <label htmlFor="new-campaign-name">Name</label>
            <input
              id="new-campaign-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Curse of Strahd"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-campaign-description">Description</label>
            <textarea
              id="new-campaign-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Homebrew arc set in the shadow of Barovia..."
            />
          </div>
        </div>
      </div>
      {error && <p className="empty-state empty-state--error">{error}</p>}
      <div className="new-or-join__actions">
        <button type="button" className="btn btn--text" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn btn--primary">
          Create Campaign
        </button>
      </div>
    </form>
  )
}

function JoinCampaignForm({ playerId, onDone, onBack }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (!code.trim()) return

    try {
      await joinCampaign(playerId, code)
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="new-or-join panel" onSubmit={submit}>
      <h3>Join Existing Campaign</h3>
      <div className="field">
        <label htmlFor="join-code">Join Code</label>
        <input
          id="join-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="K7QX2P"
          autoFocus
          required
        />
      </div>
      {error && <p className="empty-state empty-state--error">{error}</p>}
      <div className="new-or-join__actions">
        <button type="button" className="btn btn--text" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn btn--primary">
          Join
        </button>
      </div>
    </form>
  )
}

export default NewOrJoinCampaign
