import { useMemo, useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { ENTITY_TYPES } from '../lib/entities.js'
import { relatedEntries } from '../lib/related.js'
import { formatDateTime } from '../lib/sessionMode.js'
import Modal from './Modal.jsx'
import LinkPicker from './LinkPicker.jsx'
import { RichNotesView } from './RichNotesEditor.jsx'
import { EntityChip } from './ui.jsx'
import './EntityDetailModal.scss'

// Read view of any campaign entry with everything related to it — links
// made by hand plus sessions that tagged it — and a way to add links.
// Editing stays on the entry's own tab ("Open in …").
function EntityDetailModal({ type, id, canGoBack, onBack, onClose }) {
  const data = useCampaignData()
  const nav = useCampaignNav()
  const entity = data.getEntity(type, id)
  const def = ENTITY_TYPES[type]
  const [link, setLink] = useState(null)
  const [relation, setRelation] = useState('')
  const [linkError, setLinkError] = useState(null)
  const [savingLink, setSavingLink] = useState(false)
  const [removed, setRemoved] = useState(null)

  const related = useMemo(
    () => (entity ? relatedEntries(entity, data) : []),
    [entity, data],
  )

  async function addLink(event) {
    event.preventDefault()
    if (!link || savingLink) return
    setSavingLink(true)
    setLinkError(null)
    try {
      await data.linkEntities({ type, id }, link, relation.trim())
      setLink(null)
      setRelation('')
    } catch (err) {
      setLinkError(err.message)
    } finally {
      setSavingLink(false)
    }
  }

  // Unlinking is routine and easy to reverse, so it happens immediately
  // with an Undo instead of a confirmation prompt.
  async function unlink(item) {
    const row = data.links.find((l) => l.id === item.linkId)
    try {
      await data.removeLink(item.linkId)
      setRemoved(row || null)
    } catch (err) {
      setLinkError(err.message)
    }
  }

  async function undoUnlink() {
    if (!removed) return
    const row = removed
    setRemoved(null)
    try {
      await data.linkEntities(
        { type: row.source_type, id: row.source_id },
        { type: row.target_type, id: row.target_id },
        row.relation,
        row.notes,
      )
    } catch (err) {
      setLinkError(err.message)
    }
  }

  const header = (
    <div className="entity-detail__nav">
      {canGoBack ? (
        <button type="button" className="btn btn--text" onClick={onBack}>
          &larr; Back
        </button>
      ) : (
        <span />
      )}
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  )

  if (!entity) {
    return (
      <Modal onClose={onClose} label={`${def?.label || 'Entry'} details`}>
        {header}
        <p className="inline-state">
          {data.loading ? 'Loading…' : 'This entry no longer exists — it may have been deleted.'}
        </p>
      </Modal>
    )
  }

  const groups = related.reduce((acc, item) => {
    const key = item.entity ? item.entity.label : 'Missing'
    ;(acc[key] ||= []).push(item)
    return acc
  }, {})

  return (
    <Modal onClose={onClose} label={`${entity.label}: ${entity.title}`}>
      <article className="entity-detail">
        {header}
        <header className="entity-detail__header">
          <span className="entity-detail__type">
            <span aria-hidden="true">{entity.icon}</span> {entity.label}
          </span>
          <h3 className="entity-detail__title">{entity.title || 'Untitled'}</h3>
          {entity.subtitle && <p className="entity-detail__subtitle">{entity.subtitle}</p>}
          {entity.tags?.length > 0 && (
            <ul className="entity-detail__tags" aria-label="Tags">
              {entity.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
          {entity.createdAt && (
            <p className="field-hint">Added {formatDateTime(entity.createdAt)}</p>
          )}
        </header>

        <div className="entity-detail__body narrative">
          {type === 'session' ? (
            <RichNotesView value={entity.raw.notes} />
          ) : entity.body ? (
            <p>{entity.body}</p>
          ) : (
            <p className="inline-state">No details yet.</p>
          )}
        </div>

        <section className="entity-detail__related" aria-labelledby="entity-related-heading">
          <h4 id="entity-related-heading">Related</h4>
          {related.length === 0 && (
            <p className="inline-state">
              Nothing linked yet. Link it below, or tag it in a session recap.
            </p>
          )}
          {Object.entries(groups).map(([label, items]) => (
            <div key={label} className="entity-detail__group">
              <h5>{label}</h5>
              <ul>
                {items.map((item) => (
                  <li key={item.key}>
                    <EntityChip
                      entity={item.entity}
                      missingLabel={`Deleted ${ENTITY_TYPES[item.missingType]?.label || 'entry'}`}
                      onOpen={(e) => nav.openEntity(e.type, e.id)}
                      suffix={
                        item.source === 'link' ? (
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => unlink(item)}
                            aria-label={`Remove link to ${item.entity?.title || 'deleted entry'}`}
                          >
                            ✕
                          </button>
                        ) : null
                      }
                    />
                    {item.relation && <span className="entity-detail__relation">{item.relation}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {removed && (
            <p className="entity-detail__undo" role="status">
              Link removed.{' '}
              <button type="button" className="btn btn--text" onClick={undoUnlink}>
                Undo
              </button>
            </p>
          )}

          <form className="entity-detail__add-link form-stack" onSubmit={addLink}>
            <LinkPicker
              label="Add a link"
              value={link}
              onChange={setLink}
              relation={relation}
              onRelationChange={setRelation}
              exclude={{ type, id }}
            />
            {link && (
              <div className="form-actions">
                <button type="submit" className="btn" disabled={savingLink}>
                  {savingLink ? 'Linking…' : 'Save link'}
                </button>
              </div>
            )}
            {linkError && (
              <p className="field-error" role="alert">
                {linkError}
              </p>
            )}
          </form>
        </section>

        <div className="form-actions entity-detail__footer">
          <button type="button" className="btn" onClick={() => nav.goTo(def.tab)}>
            Open in {nav.tabs.find((t) => t.id === def.tab)?.label || 'its tab'} to edit
          </button>
        </div>
      </article>
    </Modal>
  )
}

export default EntityDetailModal
