import { useMemo, useState } from 'react'
import { navigate, usePath } from '../lib/router.js'
import { parseRoute } from '../lib/routes.js'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { ENTITY_TYPES } from '../lib/entities.js'
import { relatedEntries } from '../lib/related.js'
import { WIKI_TYPES, buildWiki, indexLetter } from '../lib/wiki.js'
import { formatSessionDate } from '../lib/sessionNotes.js'
import { getPublicUrl } from '../lib/storage.js'
import { photoList, CREATURE_BUCKET } from '../lib/creatures.js'
import { attitudeInfo } from '../lib/attitude.js'
import { standingInfo } from '../lib/standing.js'
import { RichText } from './RichText.jsx'
import Icon from './Icon.jsx'
import './WikiTab.scss'

const FILTERS = [{ id: 'all', label: 'All' }, ...WIKI_TYPES.map((t) => ({ id: t, label: ENTITY_TYPES[t].plural }))]

// A recap's title, or "Quick note" (a note's "title" is just its first line).
const sourceName = (source) => (source.type === 'session' ? source.title : 'Quick note')

const shortDate = (ms) =>
  ms ? new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

// The facts box and the written-up text for each kind of article.
function articleFacts(e) {
  const r = e.raw
  switch (e.type) {
    case 'npc':
      return [
        ['Race', r.race],
        ['Status', r.status],
        ['Met', r.met_at],
        ['Feels', attitudeInfo(r.attitude)?.id],
      ]
    case 'place':
      return [['Kind', r.kind]]
    case 'lore':
      return [
        ['Category', r.category],
        ['Standing', standingInfo(r.standing)?.id],
      ]
    case 'loot':
      return [
        ['Kind', r.kind],
        ['Found', r.found_at],
        ['Held by', r.holder],
        ['Quantity', r.quantity > 1 ? r.quantity : null],
      ]
    case 'creature':
      return [
        ['Type', r.creature_type],
        ['Met', r.encountered_at],
      ]
    case 'quest':
      return [
        ['Status', r.status],
        ['Given by', r.given_by],
      ]
    default:
      return []
  }
}

const articleText = (e) => (e.type === 'npc' ? e.raw.description : e.raw.notes) || ''

function articleImage(e) {
  if (e.type === 'npc') return getPublicUrl('npc-portraits', e.raw.photo_path)
  if (e.type === 'loot') return getPublicUrl('loot-photos', e.raw.photo_path)
  if (e.type === 'creature') {
    const first = photoList(e.raw.photos)[0]
    return first ? getPublicUrl(CREATURE_BUCKET, first) : null
  }
  return null
}

// A snippet with the article's name (and tag labels) picked out.
function Snippet({ text, terms }) {
  const words = terms.filter(Boolean)
  if (!words.length) return <>{text}</>
  const re = new RegExp(`([@#~$%]?(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g')
  return (
    <>
      {text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part.replace(/^[@#~$%]/, '')}</mark> : part.replace(/(^|\s)[@#~$%](?=\S)/g, '$1')))}
    </>
  )
}

// A wiki of everything the party has written about the world: an A–Z of
// NPCs, places, lore, items, creatures and quests, each with what's known,
// the sessions (and quick notes) where it was noted — with the lines
// around it — and what it came up alongside.
// `pathFor(entity | null)` is the wiki's address (with an article open);
// `ownTabHref`, when given, offers the wiki on a page of its own.
function WikiTab({ pathFor, ownTabHref = null }) {
  const data = useCampaignData()
  const nav = useCampaignNav()
  const { entities, loading } = data
  const { articles, byKey } = useMemo(() => buildWiki(entities), [entities])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  // The open article is in the address (…/wiki/npc/1a2b3c4d), so back,
  // refresh and shared links all land on it.
  const wanted = parseRoute(usePath()).entity
  const article = wanted
    ? articles.find((a) => a.entity.type === wanted.type && String(a.entity.id).startsWith(wanted.ref)) || null
    : null
  const selected = article?.key || null

  const needle = query.trim().toLowerCase()
  const shown = articles.filter(
    (a) =>
      (filter === 'all' || a.entity.type === filter) &&
      (!needle || [a.entity.title, a.entity.subtitle, a.entity.body].some((v) => v?.toLowerCase().includes(needle))),
  )
  const groups = []
  for (const a of shown) {
    const letter = indexLetter(a.entity.title)
    if (groups.at(-1)?.letter !== letter) groups.push({ letter, items: [] })
    groups.at(-1).items.push(a)
  }
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.id === 'all' ? articles.length : articles.filter((a) => a.entity.type === f.id).length]))

  function openArticle(key) {
    const a = byKey.get(key)
    if (a) navigate(pathFor({ type: a.entity.type, id: a.entity.id }))
    document.querySelector('.wiki__article')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="wiki-shell">
      <div className={`wiki${article ? ' wiki--reading' : ''}`}>
        <aside className="wiki__index panel" aria-label="World wiki index">
          <div className="wiki__index-head">
            <h2 className="wiki__heading">
              <Icon name="library" /> World Wiki
              {ownTabHref && (
                <a
                  className="wiki__own-tab"
                  href={ownTabHref}
                  target="_blank"
                  rel="noopener"
                  title="Open the wiki on a page of its own, in a new tab"
                  aria-label="Open the wiki in its own tab"
                >
                  <Icon name="maximize" />
                </a>
              )}
            </h2>
            <input
              type="search"
              className="wiki__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the world…"
              aria-label="Search the wiki"
            />
            <div className="wiki__filters" role="group" aria-label="Show">
              {FILTERS.filter((f) => f.id === 'all' || counts[f.id]).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`wiki__filter${filter === f.id ? ' is-on' : ''}`}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label} <span>{counts[f.id]}</span>
                </button>
              ))}
            </div>
          </div>
          {loading && !articles.length && <p className="inline-state">Loading…</p>}
          {!loading && !articles.length && (
            <p className="inline-state">Nothing written yet. NPCs, places, lore, items and creatures you add show up here.</p>
          )}
          {articles.length > 0 && !shown.length && <p className="inline-state">Nothing matches “{query.trim()}”.</p>}
          <nav className="wiki__list">
            {groups.map((g) => (
              <section key={g.letter}>
                <h3 className="wiki__letter">{g.letter}</h3>
                <ul>
                  {g.items.map((a) => (
                    <li key={a.key}>
                      <button
                        type="button"
                        className={`wiki__entry${a.key === selected ? ' is-current' : ''}`}
                        onClick={() => openArticle(a.key)}
                        aria-current={a.key === selected ? 'page' : undefined}
                      >
                        <Icon name={a.entity.icon} />
                        <span className="wiki__entry-title">{a.entity.title || 'Untitled'}</span>
                        {a.notedIn.length > 0 && (
                          <span className="wiki__entry-count" title={`Noted in ${a.notedIn.length}`}>
                            {a.notedIn.length}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        </aside>

        <main className="wiki__article panel">
          {article ? (
            <Article article={article} byKey={byKey} data={data} onOpen={openArticle} onBack={() => navigate(pathFor(null))} nav={nav} />
          ) : (
            <WikiHome articles={articles} onOpen={openArticle} />
          )}
        </main>
      </div>
    </div>
  )
}

// What shows before an article is picked: the most-noted, and the latest.
function WikiHome({ articles, onOpen }) {
  const mostNoted = [...articles].filter((a) => a.notedIn.length).sort((a, b) => b.notedIn.length - a.notedIn.length).slice(0, 8)
  const latest = [...articles]
    .filter((a) => a.notedIn.length)
    .sort((a, b) => b.notedIn.at(-1).date - a.notedIn.at(-1).date)
    .slice(0, 8)
  const Row = ({ a, meta }) => (
    <li>
      <button type="button" className="wiki__link" onClick={() => onOpen(a.key)}>
        <Icon name={a.entity.icon} /> {a.entity.title}
      </button>
      <span className="wiki__meta">{meta}</span>
    </li>
  )
  return (
    <div className="wiki-home">
      <h2 className="wiki__title">The world so far</h2>
      <p className="wiki__lede">
        {articles.length} {articles.length === 1 ? 'entry' : 'entries'} the party has written about. Pick one to see what’s known and
        every session it came up in.
      </p>
      {mostNoted.length > 0 && (
        <div className="wiki-home__cols">
          <section>
            <h3 className="wiki__section">Comes up the most</h3>
            <ul className="wiki__plain">
              {mostNoted.map((a) => (
                <Row key={a.key} a={a} meta={`${a.notedIn.length} time${a.notedIn.length === 1 ? '' : 's'}`} />
              ))}
            </ul>
          </section>
          <section>
            <h3 className="wiki__section">Noted lately</h3>
            <ul className="wiki__plain">
              {latest.map((a) => (
                <Row key={a.key} a={a} meta={sourceName(a.notedIn.at(-1).source)} />
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}

function Article({ article, byKey, data, onOpen, onBack, nav }) {
  const e = article.entity
  const facts = articleFacts(e).filter(([, v]) => v !== null && v !== undefined && String(v).trim())
  const text = articleText(e)
  const image = articleImage(e)
  const first = article.notedIn[0]
  const links = relatedEntries(e, data).filter((r) => r.source === 'link' && r.entity)
  const terms = [e.title]

  return (
    <article className="wiki-article" key={article.key}>
      <button type="button" className="btn btn--text wiki-article__back" onClick={onBack}>
        <Icon name="prev" /> All entries
      </button>

      <header className="wiki-article__head">
        <div>
          <p className="wiki-article__kind">
            <Icon name={e.icon} /> {e.label}
          </p>
          <h2 className="wiki__title">{e.title || 'Untitled'}</h2>
          <p className="wiki-article__first">
            {first ? (
              <>
                First noted in <strong>{first.source.type === 'session' ? first.source.title : 'a quick note'}</strong>
                {first.date ? ` · ${shortDate(first.date)}` : ''}
              </>
            ) : (
              e.createdAt && <>Added {shortDate(Date.parse(e.createdAt))}</>
            )}
          </p>
        </div>
        <button type="button" className="btn btn--text" onClick={() => nav.openEntity(e.type, e.id)}>
          <Icon name="edit" /> Open entry
        </button>
      </header>

      <div className="wiki-article__body">
        {(image || facts.length > 0) && (
          <aside className="wiki-article__infobox">
            {image && <img src={image} alt="" />}
            {facts.length > 0 && (
              <dl>
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </aside>
        )}
        <div className="wiki-article__text">
          {text ? <RichText value={text} /> : <p className="inline-state">Nothing written on the entry itself yet.</p>}
        </div>
      </div>

      <section className="wiki-article__section">
        <h3 className="wiki__section">
          <Icon name="book" /> Noted in {article.notedIn.length ? `${article.notedIn.length} place${article.notedIn.length === 1 ? '' : 's'}` : ''}
        </h3>
        {article.notedIn.length === 0 ? (
          <p className="inline-state">Not mentioned in your session notes yet. Tag it in a recap ({ENTITY_TYPES[e.type].label}) to see it here.</p>
        ) : (
          <ol className="wiki-timeline">
            {article.notedIn.map((n) => (
              <li key={`${n.source.type}-${n.source.id}`}>
                <div className="wiki-timeline__when">
                  <button type="button" className="wiki__link" onClick={() => nav.openEntity(n.source.type, n.source.id)}>
                    {sourceName(n.source)}
                  </button>
                  <span className="wiki__meta">
                    {n.source.type === 'session' && n.source.raw.session_date
                      ? formatSessionDate(n.source.raw.session_date)
                      : shortDate(n.date)}
                    {!n.tagged && ' · by name'}
                  </span>
                </div>
                {n.snippets.map((s, i) => (
                  <blockquote key={i} className="wiki-timeline__quote">
                    <Snippet text={s} terms={terms} />
                  </blockquote>
                ))}
              </li>
            ))}
          </ol>
        )}
      </section>

      {(links.length > 0 || article.alongside.length > 0) && (
        <section className="wiki-article__section">
          <h3 className="wiki__section">
            <Icon name="network" /> Connections
          </h3>
          <ul className="wiki-article__chips">
            {links.map((r) => {
              const key = `${r.entity.type}:${r.entity.id}`
              return (
                <li key={r.key}>
                  <button
                    type="button"
                    className="wiki-chip"
                    onClick={() => (byKey.has(key) ? onOpen(key) : nav.openEntity(r.entity.type, r.entity.id))}
                  >
                    <Icon name={r.entity.icon} /> {r.entity.title}
                    {r.relation && <span>{r.relation}</span>}
                  </button>
                </li>
              )
            })}
            {article.alongside
              .filter((a) => !links.some((r) => `${r.entity.type}:${r.entity.id}` === a.key))
              .map(({ key, count }) => {
                const other = byKey.get(key)
                return (
                  <li key={key}>
                    <button type="button" className="wiki-chip" onClick={() => onOpen(key)}>
                      <Icon name={other.entity.icon} /> {other.entity.title}
                      <span>came up together{count > 1 ? ` ×${count}` : ''}</span>
                    </button>
                  </li>
                )
              })}
          </ul>
        </section>
      )}
    </article>
  )
}

export default WikiTab
