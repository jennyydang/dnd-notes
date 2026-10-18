import { useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { deadline, stepLabel } from '../lib/calendar.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import { DeadlineBadge } from './Deadline.jsx'
import './WorldCalendar.scss'

const QUICK = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: 'A week' },
]

// The campaign's in-world day ("Day 47") with "+1 day" for a long rest,
// and "Time passes…" for travel and downtime: how many days and why. Any
// quest or goal coming due is listed alongside.
function WorldCalendar() {
  const { calendar } = useCampaignData()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function advance(days, note) {
    setBusy(true)
    setError(null)
    try {
      await calendar.advance(days, note)
      return true
    } catch (err) {
      setError(/campaign_calendar/.test(err.message) ? 'Run the latest supabase/schema.sql to add the calendar.' : err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="world-calendar">
      <button type="button" className="world-calendar__day" onClick={() => setOpen(true)} title="In-world calendar">
        <Icon name="calendar" /> Day {calendar.day}
      </button>
      <button type="button" className="btn btn--text world-calendar__step" onClick={() => advance(1, 'A day passes')} disabled={busy}>
        +1 day
      </button>
      {error && !open && <span className="field-error">{error}</span>}
      {open && <TimePasses onClose={() => setOpen(false)} advance={advance} busy={busy} error={error} />}
    </div>
  )
}

function TimePasses({ onClose, advance, busy, error }) {
  const { calendar, entities } = useCampaignData()
  const nav = useCampaignNav()
  const [days, setDays] = useState('1')
  const [note, setNote] = useState('')
  const n = Math.trunc(Number(days))
  const comingDue = entities
    .filter((e) => (e.type === 'quest' || e.type === 'goal') && e.open && e.raw?.due_day != null)
    .map((e) => ({ e, d: deadline(e.raw.due_day, calendar.day) }))
    .sort((a, b) => a.d.left - b.d.left)

  async function submit(event) {
    event.preventDefault()
    if (!n) return
    if (await advance(n, note)) onClose()
  }

  return (
    <Modal onClose={onClose} label="In-world calendar" size="narrow">
      <form className="time-passes" onSubmit={submit}>
        <h3 className="time-passes__title">
          <Icon name="calendar" /> Day {calendar.day}
        </h3>
        <p className="time-passes__hint">Travel, downtime or a long wait? Move the calendar on — deadlines count down with it.</p>
        <div className="time-passes__quick" role="group" aria-label="Quick picks">
          {QUICK.map((q) => (
            <button
              key={q.days}
              type="button"
              className={`time-passes__chip${n === q.days ? ' is-on' : ''}`}
              onClick={() => setDays(String(q.days))}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="time-days">Days</label>
            <input id="time-days" type="number" step="1" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="time-why">What happened (optional)</label>
            <input id="time-why" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Kingsroad to Palomerie" />
          </div>
        </div>
        {n < 0 && <p className="time-passes__hint">Going back {-n} day{n === -1 ? '' : 's'} — for fixing a mistake.</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy || !n}>
            {busy ? 'Saving…' : n > 0 ? `Move to day ${calendar.day + n}` : n < 0 ? `Back to day ${Math.max(1, calendar.day + n)}` : 'Move on'}
          </button>
        </div>

        {comingDue.length > 0 && (
          <section className="time-passes__section">
            <h4>Deadlines</h4>
            <ul className="time-passes__due">
              {comingDue.map(({ e }) => (
                <li key={`${e.type}-${e.id}`}>
                  <button
                    type="button"
                    className="time-passes__link"
                    onClick={() => {
                      onClose()
                      nav.openEntity(e.type, e.id)
                    }}
                  >
                    {e.title}
                  </button>
                  <DeadlineBadge dueDay={e.raw.due_day} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {calendar.log.length > 0 && (
          <section className="time-passes__section">
            <h4>
              <Icon name="hourglass" /> Recently
            </h4>
            <ol className="time-passes__log">
              {[...calendar.log]
                .reverse()
                .slice(0, 8)
                .map((entry, i) => (
                  <li key={i}>
                    <span className="time-passes__step">{stepLabel(entry)}</span>
                    <span>
                      Day {entry.from} → {entry.to}
                      {entry.note && <em> · {entry.note}</em>}
                    </span>
                  </li>
                ))}
            </ol>
          </section>
        )}
      </form>
    </Modal>
  )
}

export default WorldCalendar
