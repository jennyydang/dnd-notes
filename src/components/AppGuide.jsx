import { useMemo, useRef, useState } from 'react'
import { GUIDE } from '../lib/guide.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import './AppGuide.scss'

const AUDIENCES = [
  { id: 'all', label: 'Everything' },
  { id: 'player', label: 'Players' },
  { id: 'dm', label: 'DMs' },
]

// **bold** and `keys` inside guide text.
function Rich({ text }) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith('`') ? (
      <kbd key={i}>{part.slice(1, -1)}</kbd>
    ) : (
      part
    ),
  )
}

const topicText = (t) => [t.title, t.where, ...(t.steps || []), ...(t.tips || [])].join(' ').toLowerCase()

// How to use every part of the app, opened from the account menu: a
// contents list beside the sections, with search and a players / DM
// filter. The words come from lib/guide.js.
function AppGuide({ onClose }) {
  const [audience, setAudience] = useState('all')
  const [query, setQuery] = useState('')
  const bodyRef = useRef(null)
  const needle = query.trim().toLowerCase()

  const sections = useMemo(
    () =>
      GUIDE.map((s) => ({
        ...s,
        topics: s.topics.filter(
          (t) =>
            (audience === 'all' || (t.for || s.for || 'all') === 'all' || (t.for || s.for) === audience) &&
            (!needle || topicText(t).includes(needle) || s.title.toLowerCase().includes(needle)),
        ),
      })).filter((s) => s.topics.length),
    [audience, needle],
  )

  function jump(id) {
    const el = bodyRef.current?.querySelector(`#guide-${id}`)
    if (el) bodyRef.current.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' })
  }

  return (
    <Modal onClose={onClose} label="App guide" size="guide">
      <div className="app-guide">
        <header className="app-guide__head">
          <h2 className="app-guide__title">
            <Icon name="book" /> How to use Adventurer’s Log
          </h2>
          <button type="button" className="icon-btn app-guide__close" aria-label="Close guide" onClick={onClose}>
            <Icon name="close" />
          </button>
          <input
            type="search"
            className="app-guide__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the guide — “initiative”, “tags”, “map pins”…"
            aria-label="Search the guide"
          />
          <div className="app-guide__audience" role="group" aria-label="Show topics for">
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`app-guide__pill${audience === a.id ? ' is-on' : ''}`}
                aria-pressed={audience === a.id}
                onClick={() => setAudience(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </header>

        <div className="app-guide__layout">
          <nav className="app-guide__toc" aria-label="Guide contents">
            {sections.map((s) => (
              <button key={s.id} type="button" className="app-guide__toc-item" onClick={() => jump(s.id)}>
                <Icon name={s.icon} /> {s.title}
              </button>
            ))}
          </nav>

          <div className="app-guide__body" ref={bodyRef}>
            {sections.length === 0 && <p className="inline-state">Nothing in the guide matches “{query.trim()}”.</p>}
            {sections.map((s) => (
              <section key={s.id} id={`guide-${s.id}`} className="app-guide__section">
                <h3 className="app-guide__section-title">
                  <Icon name={s.icon} /> {s.title}
                  {s.for === 'dm' && <span className="app-guide__badge">DM</span>}
                </h3>
                {s.intro && !needle && (
                  <p className="app-guide__intro">
                    <Rich text={s.intro} />
                  </p>
                )}
                {s.topics.map((t) => (
                  <article key={t.title} className="app-guide__topic">
                    <h4>
                      {t.title}
                      {(t.for || s.for) === 'dm' && s.for !== 'dm' && <span className="app-guide__badge">DM</span>}
                    </h4>
                    {t.where && (
                      <p className="app-guide__where">
                        <Icon name="compass" /> <Rich text={t.where} />
                      </p>
                    )}
                    {t.steps?.length > 0 && (
                      <ol className="app-guide__steps">
                        {t.steps.map((step, i) => (
                          <li key={i}>
                            <Rich text={step} />
                          </li>
                        ))}
                      </ol>
                    )}
                    {t.tips?.length > 0 && (
                      <ul className="app-guide__tips">
                        {t.tips.map((tip, i) => (
                          <li key={i}>
                            <Rich text={tip} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default AppGuide
