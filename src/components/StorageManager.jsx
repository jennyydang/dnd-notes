import { useCallback, useEffect, useRef, useState } from 'react'
import {
  STORAGE_BUCKETS,
  STORAGE_LIMIT_BYTES,
  bucketLabel,
  formatBytes,
  loadStorageUsage,
  shrinkStoredFile,
} from '../lib/storageUsage.js'
import { AUDIO_BUCKET } from '../lib/sessionRecorder.js'
import { getPublicUrl } from '../lib/storage.js'
import Icon from './Icon.jsx'
import './StorageManager.scss'

const BIGGEST = 25
const keyOf = (f) => `${f.bucket}/${f.path}`

// The Storage tile's numbers and the section's file list share one load.
export function useStorageUsage() {
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)
  const refresh = useCallback(async () => {
    try {
      setUsage(await loadStorageUsage())
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  return { usage, error, refresh }
}

const shortDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

function resultText(r) {
  if (!r) return null
  if (r.state === 'working') return r.value != null ? `Shrinking… ${Math.round(r.value * 100)}%` : 'Shrinking…'
  if (r.state === 'error') return `Couldn’t shrink: ${r.message}`
  if (r.state === 'skipped') return 'Already light'
  return `Saved ${formatBytes(r.before - r.after)} (now ${formatBytes(r.after)})`
}

// Admin → Storage: how much of the plan's file storage is used, what by,
// and a way to shrink what was uploaded before uploads were shrunk.
function StorageManager({ usage, error, refresh }) {
  const [results, setResults] = useState({}) // key → { state, ... }
  const [run, setRun] = useState(null) // shrink-everything progress
  const stopRef = useRef(false)

  const setResult = (file, r) => setResults((prev) => ({ ...prev, [keyOf(file)]: r }))

  async function shrinkOne(file) {
    setResult(file, { state: 'working' })
    try {
      const r = await shrinkStoredFile(file, (value) => setResult(file, { state: 'working', value }))
      setResult(file, r ? { state: 'done', ...r } : { state: 'skipped' })
      return r
    } catch (err) {
      setResult(file, { state: 'error', message: err.message })
      return null
    }
  }

  async function shrinkAll() {
    if (!usage) return
    stopRef.current = false
    // Biggest first, so stopping early still frees the most.
    const queue = usage.files.filter((f) => !['done', 'skipped'].includes(results[keyOf(f)]?.state))
    const handled = new Set()
    let saved = 0
    for (const [i, file] of queue.entries()) {
      if (stopRef.current) break
      setRun({ index: i + 1, total: queue.length, saved })
      if (handled.has(keyOf(file))) continue // a piece of a recording already shrunk
      const r = await shrinkOne(file)
      if (r) {
        saved += r.before - r.after
        for (const path of r.replaced || []) handled.add(`${AUDIO_BUCKET}/${path}`)
      }
    }
    setRun({ index: queue.length, total: queue.length, saved, finished: true })
    await refresh()
  }

  if (error) return <p className="field-error">Couldn’t read storage: {error}</p>
  if (!usage) return <p className="storage__hint">Adding up your files…</p>

  const pct = Math.min(100, (usage.total / STORAGE_LIMIT_BYTES) * 100)
  const buckets = STORAGE_BUCKETS.filter((b) => usage.byBucket[b.id].count > 0).sort(
    (a, b) => usage.byBucket[b.id].bytes - usage.byBucket[a.id].bytes,
  )
  const running = run && !run.finished

  return (
    <section className="storage">
      <div className="storage__meter panel">
        <div className="storage__meter-head">
          <span className="storage__used">{formatBytes(usage.total)}</span>
          <span className="storage__of">of {formatBytes(STORAGE_LIMIT_BYTES)} used · {usage.files.length} files</span>
        </div>
        <div
          className={`storage__bar${pct >= 90 ? ' storage__bar--full' : pct >= 70 ? ' storage__bar--high' : ''}`}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="Storage used"
        >
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="storage__hint">
          {formatBytes(Math.max(0, STORAGE_LIMIT_BYTES - usage.total))} free on Supabase’s Free plan. New uploads are
          shrunk automatically; shrink older files below to free more.
        </p>
      </div>

      <ul className="storage__buckets">
        {buckets.map((b) => {
          const { bytes, count } = usage.byBucket[b.id]
          return (
            <li key={b.id} className="storage__bucket">
              <span className="storage__bucket-name">
                <Icon name={b.icon} /> {b.label}
              </span>
              <span className="storage__bucket-size">
                {formatBytes(bytes)} · {count} file{count === 1 ? '' : 's'}
              </span>
              <span className="storage__bucket-bar" aria-hidden="true">
                <span style={{ width: `${usage.total ? (bytes / usage.total) * 100 : 0}%` }} />
              </span>
            </li>
          )
        })}
      </ul>

      <div className="storage__shrink panel">
        <div>
          <h4 className="storage__heading">
            <Icon name="shrink" /> Shrink everything
          </h4>
          <p className="storage__hint">
            Re-saves older pictures as WebP at a sensible size and big recordings as speech-quality WebM. Everything
            keeps working where it’s used; files that are already light are left alone. Recordings take a while — keep
            this page open.
          </p>
          {run && (
            <p className="storage__progress" role="status">
              {run.finished
                ? `Done — saved ${formatBytes(run.saved)}.`
                : `Shrinking ${run.index} of ${run.total} · saved ${formatBytes(run.saved)} so far`}
            </p>
          )}
        </div>
        {running ? (
          <button type="button" className="btn" onClick={() => (stopRef.current = true)}>
            <Icon name="stop" /> Stop
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={shrinkAll} disabled={!usage.files.length}>
            <Icon name="shrink" /> Shrink everything
          </button>
        )}
      </div>

      <h4 className="storage__heading">Biggest files</h4>
      <ul className="storage__files">
        {usage.files.slice(0, BIGGEST).map((file) => {
          const r = results[keyOf(file)]
          const audio = file.bucket === AUDIO_BUCKET
          return (
            <li key={keyOf(file)} className="storage__file">
              <span className="storage__thumb">
                {audio ? (
                  <Icon name="mic" />
                ) : (
                  <img src={getPublicUrl(file.bucket, file.path)} alt="" loading="lazy" />
                )}
              </span>
              <span className="storage__file-info">
                <span className="storage__file-size">{formatBytes(file.size)}</span>
                <span className="storage__file-meta">
                  {bucketLabel(file.bucket)} · {shortDate(file.updatedAt)}
                </span>
                {r && (
                  <span className={`storage__result storage__result--${r.state}`} role="status">
                    {resultText(r)}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="btn btn--text"
                disabled={running || r?.state === 'working' || r?.state === 'done' || r?.state === 'skipped'}
                onClick={() => shrinkOne(file)}
              >
                <Icon name="shrink" /> Shrink
              </button>
            </li>
          )
        })}
      </ul>
      {usage.files.length > BIGGEST && (
        <p className="storage__hint">…and {usage.files.length - BIGGEST} smaller files (Shrink everything covers them all).</p>
      )}
    </section>
  )
}

export default StorageManager
