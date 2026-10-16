import { useMemo } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { usePolls } from '../hooks/usePolls.js'
import { goalFromRow, goalProgress, nextStep, sortGoals } from '../lib/partyGoals.js'
import { ProgressRing } from './PartyGoals.jsx'
import AnimatedNumber from './AnimatedNumber.jsx'
import { SectionCard } from './ui.jsx'
import Icon from './Icon.jsx'
import { ATTITUDES } from '../lib/attitude.js'
import './DmOverview.scss'

const DISCOVERY_TYPES = ['npc', 'place', 'lore', 'loot', 'quest']
const DAY = 24 * 60 * 60 * 1000

function ago(date) {
  if (!date) return ''
  const days = Math.floor((Date.now() - new Date(date).getTime()) / DAY)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} wk ago`
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function EntityRow({ entity, meta }) {
  const nav = useCampaignNav()
  return (
    <li>
      <button type="button" className="dm-overview__row" onClick={() => nav.openEntity(entity.type, entity.id)}>
        <span className={`dm-overview__icon dm-overview__icon--${entity.type}`} aria-hidden="true">
          <Icon name={entity.icon} />
        </span>
        <span className="dm-overview__row-text">
          <strong>{entity.title || 'Untitled'}</strong>
          {(meta || entity.subtitle) && <span>{meta || entity.subtitle}</span>}
        </span>
      </button>
    </li>
  )
}

// The DM's window onto what the players have pieced together: who they've
// met, where they've been, what they're chasing and what they've decided.
// Read-only, and only from what the players share with the whole campaign
// — their private recaps and personal goals stay private.
function DmOverview() {
  const { entities, tables } = useCampaignData()
  const nav = useCampaignNav()
  const polls = usePolls()

  const by = useMemo(() => {
    const groups = Object.fromEntries(DISCOVERY_TYPES.map((t) => [t, []]))
    for (const e of entities) if (groups[e.type]) groups[e.type].push(e)
    return groups
  }, [entities])

  const newestFirst = (list) => [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  const questsBy = (status) => by.quest.filter((q) => (q.raw?.status || 'Active') === status)
  const activeQuests = questsBy('Active')
  const rumours = questsBy('Rumour')
  const doneQuests = [...questsBy('Completed'), ...questsBy('Failed')]
  const clues = by.lore.filter((l) => /^clue$/i.test(l.raw?.category || ''))

  const discoveries = newestFirst(DISCOVERY_TYPES.flatMap((t) => by[t])).slice(0, 12)
  const { active: goals, achieved: doneGoals } = sortGoals(tables.goal.items.map(goalFromRow))
  const party = tables.character.items
  const decisions = polls.polls.filter((p) => p.status === 'closed' && p.result).slice(0, 6)
  const openVotes = polls.polls.filter((p) => p.status === 'open')

  const stats = [
    { label: 'NPCs met', value: by.npc.length, icon: 'users' },
    { label: 'Places found', value: by.place.length, icon: 'pin' },
    { label: 'Active quests', value: activeQuests.length, icon: 'quest' },
    { label: 'Quests done', value: doneQuests.length, icon: 'check-square' },
    { label: 'Lore & clues', value: by.lore.length, icon: 'scroll' },
    { label: 'Loot', value: by.loot.length, icon: 'coins' },
  ]

  const nothingYet = discoveries.length === 0 && !goals.length && !party.length

  return (
    <div className="dm-overview">
      <section className="dm-overview__hero panel">
        <p className="dm-overview__eyebrow">Party overview</p>
        <h2 className="dm-overview__title">What the party has pieced together</h2>
        <p className="dm-overview__lead">
          Everything your players have shared in their journal — so you can see what they know, what they’re chasing and
          what they’ve decided. Their private recaps and personal goals aren’t shown.
        </p>
        <ul className="dm-overview__stats">
          {stats.map((s) => (
            <li key={s.label} className="dm-overview__stat">
              <Icon name={s.icon} />
              <AnimatedNumber value={s.value} className="dm-overview__stat-value" />
              <span className="dm-overview__stat-label">{s.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {nothingYet ? (
        <p className="empty-state">
          Nothing shared yet. As your players add NPCs, places, quests and goals, they’ll show up here.
        </p>
      ) : (
        <div className="dm-overview__grid">
          <SectionCard title="What they’re chasing" icon="quest" className="dm-overview__card">
            {activeQuests.length + rumours.length === 0 ? (
              <p className="inline-state">No active quests or rumours.</p>
            ) : (
              <>
                {activeQuests.length > 0 && (
                  <>
                    <h4 className="dm-overview__sub">Active</h4>
                    <ul className="dm-overview__list">
                      {activeQuests.map((q) => (
                        <EntityRow key={q.id} entity={q} meta={q.raw?.given_by ? `Given by ${q.raw.given_by}` : ''} />
                      ))}
                    </ul>
                  </>
                )}
                {rumours.length > 0 && (
                  <>
                    <h4 className="dm-overview__sub">Rumours they’ve heard</h4>
                    <ul className="dm-overview__list">
                      {rumours.map((q) => (
                        <EntityRow key={q.id} entity={q} meta=" " />
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
            {doneQuests.length > 0 && (
              <p className="dm-overview__foot">
                {doneQuests.length} quest{doneQuests.length === 1 ? '' : 's'} finished:{' '}
                {doneQuests.map((q) => q.title).join(', ')}
              </p>
            )}
          </SectionCard>

          <SectionCard title="Who’s with us" icon="users" className="dm-overview__card">
            {by.npc.some((n) => n.raw?.attitude) ? (
              <ul className="dm-overview__attitudes">
                {[...ATTITUDES].reverse().map((a) => {
                  const people = by.npc.filter((n) => n.raw?.attitude === a.id)
                  if (!people.length) return null
                  return (
                    <li key={a.id}>
                      <span className="dm-overview__attitude" style={{ '--attitude': a.color }}>
                        {a.id}
                      </span>
                      <span className="dm-overview__people">
                        {people.map((n) => (
                          <button key={n.id} type="button" className="dm-overview__person" onClick={() => nav.openEntity('npc', n.id)}>
                            {n.title}
                          </button>
                        ))}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="inline-state">The party hasn’t marked how any NPC feels about them yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Party goals" icon="target" className="dm-overview__card">
            {goals.length + doneGoals.length === 0 ? (
              <p className="inline-state">The party hasn’t set any goals yet.</p>
            ) : (
              <ul className="dm-overview__goals">
                {[...goals, ...doneGoals].map((g) => {
                  const next = nextStep(g)
                  return (
                    <li key={g.id} className={g.status === 'Completed' ? 'is-done' : ''}>
                      <ProgressRing value={goalProgress(g)} size={40} stroke={4} />
                      <span className="dm-overview__row-text">
                        <strong>{g.title}</strong>
                        <span>
                          {g.status === 'Completed'
                            ? 'Done'
                            : next
                              ? `Next: ${next.text}`
                              : g.steps.length
                                ? 'Every step done'
                                : 'No steps yet'}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Latest discoveries" icon="compass" className="dm-overview__card dm-overview__card--wide">
            {discoveries.length === 0 ? (
              <p className="inline-state">Nothing recorded yet.</p>
            ) : (
              <ul className="dm-overview__list dm-overview__list--columns">
                {discoveries.map((e) => (
                  <EntityRow key={`${e.type}:${e.id}`} entity={e} meta={`${e.label} · ${ago(e.createdAt)}`} />
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Clues they’re holding" icon="search" className="dm-overview__card">
            {clues.length === 0 ? (
              <p className="inline-state">No clues noted yet.</p>
            ) : (
              <ul className="dm-overview__list">
                {newestFirst(clues).map((c) => (
                  <EntityRow key={c.id} entity={c} meta={c.body ? c.body.slice(0, 90) : ' '} />
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="What they’ve decided" icon="vote" className="dm-overview__card">
            {openVotes.length > 0 && (
              <p className="dm-overview__live">
                <span className="dm-overview__pulse" aria-hidden="true" /> Voting now: {openVotes.map((p) => `“${p.question}”`).join(', ')}
              </p>
            )}
            {decisions.length === 0 ? (
              <p className="inline-state">No party votes decided yet.</p>
            ) : (
              <ul className="dm-overview__decisions">
                {decisions.map((p) => (
                  <li key={p.id}>
                    {p.result.replace(/^Party vote — /, '')}
                    <span>{ago(p.closedAt || p.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="The party" icon="shield" className="dm-overview__card">
            {party.length === 0 ? (
              <p className="inline-state">No party members recorded.</p>
            ) : (
              <ul className="dm-overview__party">
                {party.map((m) => (
                  <li key={m.id}>
                    <strong>{m.name}</strong>
                    <span>{[m.race_class, m.level && `Level ${m.level}`].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  )
}

export default DmOverview
