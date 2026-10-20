import { useId, useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { usePrep } from '../hooks/usePrep.js'
import { newId } from '../lib/character.js'
import { mentionedIn } from '../lib/related.js'
import { formatSessionDate, sessionDateTimestamp } from '../lib/sessionNotes.js'
import LinkPicker from './LinkPicker.jsx'
import { RichNotesView } from './RichNotesEditor.jsx'
import { EntityChip, SaveStatus, SectionCard, StatusMessage } from './ui.jsx'
import Icon from './Icon.jsx'
import './PrepTab.scss'

// "Came up recently" shows this many before a "+N more".
const RECENT_LIMIT = 12

const LISTS = [
  { key: 'objectives', title: 'Planned scenes & objectives', icon: 'target', placeholder: 'Confront Elandra about the ledger' },
  { key: 'questions', title: 'Questions for the DM', icon: 'help', placeholder: 'Can I cast Speak with Dead on the courier?' },
  { key: 'prepare', title: 'Items & abilities to prepare', icon: 'backpack', placeholder: 'Prepare Gentle Repose' },
  { key: 'checklist', title: 'Before the session', icon: 'check-square', placeholder: 'Level up, reread last recap…' },
]

function PrepItem({ item, onChange, onRemove, onOpen }) {
  const { getEntity } = useCampaignData()
  const [linking, setLinking] = useState(false)
  const id = useId()
  const linked = item.link ? getEntity(item.link.type, item.link.id) : null

  return (
    <li className={`prep-item${item.done ? ' prep-item--done' : ''}`}>
      <input
        id={`${id}-done`}
        type="checkbox"
        className="prep-item__check"
        checked={Boolean(item.done)}
        onChange={(e) => onChange({ ...item, done: e.target.checked })}
        aria-label={`Mark “${item.text}” done`}
      />
      <div className="prep-item__main">
        <label htmlFor={`${id}-text`} className="sr-only">
          Item text
        </label>
        <input
          id={`${id}-text`}
          type="text"
          value={item.text}
          onChange={(e) => onChange({ ...item, text: e.target.value })}
        />
        {item.link && (
          <EntityChip
            entity={linked}
            missingLabel="Linked entry was deleted"
            onOpen={onOpen}
            suffix={
              <button type="button" className="icon-btn" onClick={() => onChange({ ...item, link: null })} aria-label="Remove link">
                ✕
              </button>
            }
          />
        )}
        {linking && !item.link && (
          <LinkPicker
            label="Link to an entry"
            value={null}
            showRelation={false}
            onChange={(link) => {
              onChange({ ...item, link })
              setLinking(false)
            }}
          />
        )}
      </div>
      <div className="prep-item__actions">
        {!item.link && (
          <button type="button" className="icon-btn" onClick={() => setLinking((v) => !v)} aria-label="Link to an entry" aria-expanded={linking}>
            <Icon name="link" />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={onRemove} aria-label={`Remove “${item.text}”`}>
          ✕
        </button>
      </div>
    </li>
  )
}

function PrepList({ def, items, onChange, onOpen, className = '' }) {
  const [draft, setDraft] = useState('')
  const inputId = useId()
  const done = items.filter((i) => i.done).length
  return (
    <SectionCard
      title={def.title}
      icon={def.icon}
      className={className}
      action={items.length > 0 && <span className="field-hint">{done}/{items.length} done</span>}
    >
      {items.length > 0 && (
        <ul className="prep-list">
          {items.map((item) => (
            <PrepItem
              key={item.id}
              item={item}
              onOpen={onOpen}
              onChange={(next) => onChange(items.map((i) => (i.id === item.id ? next : i)))}
              onRemove={() => onChange(items.filter((i) => i.id !== item.id))}
            />
          ))}
        </ul>
      )}
      <form
        className="prep-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          onChange([...items, { id: newId(), text: draft.trim(), done: false, link: null }])
          setDraft('')
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Add to {def.title}
        </label>
        <input id={inputId} type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={def.placeholder} />
        <button type="submit" className="btn">
          Add
        </button>
      </form>
    </SectionCard>
  )
}

// Between-session planning: what happened last time, what's still open,
// who and where came up, plus the player's own lists. Autosaved per player.
function PrepTab() {
  const data = useCampaignData()
  const nav = useCampaignNav()
  const { campaignId, playerId, entities, loading } = data
  const prep = usePrep(campaignId, playerId)
  const [showAllRecent, setShowAllRecent] = useState(false)
  const open = (e) => nav.openEntity(e.type, e.id)

  if (!playerId) {
    return (
      <SectionCard title="Session prep" icon="prep">
        <p className="inline-state">Prep is personal to each player — log in as a player to use it.</p>
      </SectionCard>
    )
  }

  const sessions = entities
    .filter((e) => e.type === 'session')
    .sort(
      (a, b) =>
        sessionDateTimestamp(b.raw.session_date) - sessionDateTimestamp(a.raw.session_date) ||
        new Date(b.createdAt) - new Date(a.createdAt),
    )
  const last = sessions[0]
  const recentlyMentioned = mentionedIn(sessions.slice(0, 2), data).filter((e) => ['npc', 'place'].includes(e.type))
  const openThreads = entities.filter((e) => e.open)
  const doc = prep.doc
  const setList = (key) => (items) => prep.update((d) => ({ ...d, [key]: items }))
  const recentShown = showAllRecent ? recentlyMentioned : recentlyMentioned.slice(0, RECENT_LIMIT)
  const listCard = (key, className) => {
    const def = LISTS.find((l) => l.key === key)
    return doc ? (
      <PrepList def={def} items={doc[key]} onChange={setList(key)} onOpen={open} className={className} />
    ) : null
  }

  function addThreadAsObjective(entity) {
    prep.update((d) => ({
      ...d,
      objectives: [...d.objectives, { id: newId(), text: `Follow up: ${entity.title}`, done: false, link: { type: entity.type, id: entity.id } }],
    }))
  }

  return (
    <div className="prep">
      <div className="prep__top">
        <div className="field prep__date">
          <label htmlFor="prep-next-date">Next session</label>
          <input
            id="prep-next-date"
            type="date"
            value={doc?.nextSessionDate || ''}
            disabled={!doc}
            onChange={(e) => prep.update((d) => ({ ...d, nextSessionDate: e.target.value }))}
          />
        </div>
        <SaveStatus status={prep.status} error={prep.saveError} onRetry={prep.retry} />
      </div>
      {prep.error && (
        <p className="inline-state inline-state--error" role="alert">
          Couldn&apos;t load your prep: {prep.error}. If this is a new install, run the latest{' '}
          <code>supabase/schema.sql</code>.
        </p>
      )}

      {/* Three columns that stack on their own (no row gaps): what
          happened, what to do, who's involved. On a phone they become one
          list, in the order below. */}
      <div className="prep__grid">
        <div className="prep__col">
          <SectionCard
            title="Last session"
            icon="book"
            className="prep__recap prep__card--1"
            action={
              last && (
                <button type="button" className="btn btn--text" onClick={() => open(last)}>
                  Details
                </button>
              )
            }
          >
            <StatusMessage loading={loading && !entities.length} empty={!last}>
              No recap yet — it will appear here after your first session.
            </StatusMessage>
            {last && (
              <>
                <p className="prep__recap-title">
                  <strong>{last.title}</strong>
                  {last.raw.session_date && ` · ${formatSessionDate(last.raw.session_date)}`}
                </p>
                <div className="prep__recap-body">
                  <RichNotesView value={last.raw.notes} />
                </div>
              </>
            )}
          </SectionCard>

          {listCard('checklist', 'prep__card--7')}
        </div>
        <div className="prep__col">
          <SectionCard title="Open threads" icon="threads" className="prep__card--2">
            <StatusMessage loading={loading && !entities.length} empty={!openThreads.length}>
              No active quests or party goals.
            </StatusMessage>
            {openThreads.length > 0 && (
              <ul className="prep__chips">
                {openThreads.map((e) => (
                  <li key={`${e.type}-${e.id}`}>
                    <EntityChip
                      entity={e}
                      onOpen={open}
                      suffix={
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => addThreadAsObjective(e)}
                          aria-label={`Add “${e.title}” to objectives`}
                          disabled={!doc}
                        >
                          ＋
                        </button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {listCard('objectives', 'prep__card--4')}
          {listCard('prepare', 'prep__card--6')}
        </div>
        <div className="prep__col">
          <SectionCard
            title="Came up recently"
            icon="users"
            className="prep__card--3"
            action={
              recentlyMentioned.length > RECENT_LIMIT && (
                <button type="button" className="btn btn--text" onClick={() => setShowAllRecent((v) => !v)}>
                  {showAllRecent ? 'Fewer' : `+${recentlyMentioned.length - RECENT_LIMIT} more`}
                </button>
              )
            }
          >
            <StatusMessage loading={loading && !entities.length} empty={!recentlyMentioned.length}>
              NPCs and places tagged in your last two recaps show up here.
            </StatusMessage>
            {recentlyMentioned.length > 0 && (
              <ul className="prep__chips prep__chips--wrap">
                {recentShown.map((e) => (
                  <li key={`${e.type}-${e.id}`}>
                    <EntityChip entity={e} onOpen={open} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {listCard('questions', 'prep__card--5')}
        </div>
      </div>
      {!doc && !prep.error && <p className="inline-state">Loading your prep…</p>}
    </div>
  )
}

export default PrepTab
