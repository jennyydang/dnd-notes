import { useCampaignData } from '../hooks/useCampaignData.js'
import { deadline } from '../lib/calendar.js'
import Icon from './Icon.jsx'
import './Deadline.scss'

// "3 days left" / "Due today" / "Overdue by 2 days" for a quest or goal
// with a deadline, counted on the campaign's in-world calendar.
export function DeadlineBadge({ dueDay, className = '' }) {
  const { calendar } = useCampaignData()
  const d = deadline(dueDay, calendar.day)
  if (!d) return null
  return (
    <span className={`deadline deadline--${d.tone} ${className}`} title={`Due on day ${dueDay} (today is day ${calendar.day})`}>
      <Icon name="hourglass" /> {d.text}
    </span>
  )
}

// A form field: "Due in [ 4 ] days". Blank means no deadline. Works in
// days from today; the form saves dueDayFromNow(today, value).
export function DueInField({ id, value, onChange }) {
  const { calendar } = useCampaignData()
  return (
    <div className="field deadline-field">
      <label htmlFor={id}>Deadline (optional)</label>
      <div className="deadline-field__row">
        <span>Due in</span>
        <input
          id={id}
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="–"
        />
        <span>days</span>
        <span className="deadline-field__today">· today is day {calendar.day}</span>
      </div>
    </div>
  )
}
