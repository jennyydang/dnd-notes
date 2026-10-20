import { useState } from 'react'
import { formatDuration, saveMarks } from '../lib/sessionRecorder.js'
import Icon from './Icon.jsx'

// A recording's bookmarks on its recap page: tap a time to jump there,
// rename or delete a mark, or mark the moment you're listening to.
function RecordingMarks({ sessionId, marks, player, position, onSaved }) {
  const [list, setList] = useState(marks)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save(next) {
    const before = list
    setList(next)
    setSaving(true)
    setError(null)
    try {
      setList(await saveMarks(sessionId, next))
      onSaved?.()
    } catch (err) {
      setList(before)
      setError(`Couldn’t save marks: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const rename = (i, label) => {
    const clean = label.trim()
    if (!clean || clean === list[i].label) return
    save(list.map((m, j) => (j === i ? { ...m, label: clean } : m)))
  }

  return (
    <div className="recording-marks">
      <div className="recording-marks__head">
        <h5>
          <Icon name="bookmark" /> Marks
        </h5>
        <button
          type="button"
          className="btn btn--text"
          disabled={saving}
          onClick={() => {
            const t = Math.floor(player.current?.time() ?? position ?? 0)
            save([...list, { t, label: `Mark at ${formatDuration(t)}` }])
          }}
        >
          <Icon name="plus" /> Mark {formatDuration(Math.floor(position || 0))}
        </button>
      </div>
      {list.length === 0 ? (
        <p className="recording-marks__empty">
          No marks yet. Tap <strong>Mark</strong> while recording — or here while listening — to bookmark a moment.
        </p>
      ) : (
        <ol className="recording-marks__list">
          {list.map((m, i) => (
            <li key={`${m.t}-${i}`} className="recording-marks__item">
              <button
                type="button"
                className="recording-marks__time"
                onClick={() => player.current?.seek(m.t)}
                aria-label={`Play from ${formatDuration(m.t)}`}
              >
                <Icon name="play" /> {formatDuration(m.t)}
              </button>
              <input
                className="recording-marks__label"
                defaultValue={m.label}
                aria-label={`Name of the mark at ${formatDuration(m.t)}`}
                onBlur={(e) => rename(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    e.currentTarget.value = m.label
                    e.currentTarget.blur()
                  }
                }}
              />
              <button
                type="button"
                className="recording-marks__delete"
                onClick={() => save(list.filter((_, j) => j !== i))}
                aria-label={`Delete the mark at ${formatDuration(m.t)}`}
                title="Delete mark"
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

export default RecordingMarks
