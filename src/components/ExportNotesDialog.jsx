import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { getStored, setStored } from '../lib/sessionMode.js'
import {
  copyRich,
  copyText,
  downloadFile,
  htmlDocument,
  printDocument,
  safeFileName,
  sessionTitle,
  sessionsToHtml,
  sessionsToMarkdown,
  sortChronologically,
} from '../lib/exportNotes.js'
import './ExportNotesDialog.scss'

const TAGS_KEY = 'dnd-notes-export-include-tags'

// Export one session recap, or all of them, for use outside the app:
// copy into Word / Google Docs / ChatGPT, download a file, or save a PDF.
function ExportNotesDialog({ sessions, campaignName, onClose }) {
  const isAll = sessions.length > 1
  const [includeTags, setIncludeTagsState] = useState(() => getStored(TAGS_KEY, true) !== false)
  const setIncludeTags = (value) => {
    setIncludeTagsState(value)
    setStored(TAGS_KEY, value)
  }
  const [status, setStatus] = useState(null) // { ok, message }

  const ordered = useMemo(() => sortChronologically(sessions), [sessions])
  const title = isAll ? `${campaignName ? `${campaignName} — ` : ''}Session Notes` : sessionTitle(sessions[0])
  const docTitle = isAll ? title : undefined
  const fileBase = safeFileName(isAll ? `${campaignName || 'campaign'}-session-notes` : sessionTitle(sessions[0]))

  const markdown = () => sessionsToMarkdown(ordered, { title: docTitle, includeTags })
  const html = () => sessionsToHtml(ordered, { title: docTitle, includeTags })

  async function run(action, success) {
    setStatus(null)
    try {
      await action()
      setStatus({ ok: true, message: success })
    } catch (err) {
      setStatus({ ok: false, message: `That didn’t work: ${err.message}` })
    }
  }

  const options = [
    {
      id: 'copy-text',
      icon: '🤖',
      label: 'Copy as text',
      detail: 'For ChatGPT, Claude, Discord, messages or notes apps.',
      action: () => run(() => copyText(markdown()), 'Copied! Paste it anywhere.'),
    },
    {
      id: 'copy-rich',
      icon: '📋',
      label: 'Copy formatted',
      detail: 'Keeps headings and bold when pasted into Word or Google Docs.',
      action: () => run(() => copyRich(html(), markdown()), 'Copied with formatting! Paste it into your doc.'),
    },
    {
      id: 'word',
      icon: '📝',
      label: 'Download for Word',
      detail: 'A .doc file that opens in Word, Pages or Google Docs.',
      action: () =>
        run(
          () => downloadFile(`${fileBase}.doc`, htmlDocument(html(), title), 'application/msword'),
          'Downloaded the Word file.',
        ),
    },
    {
      id: 'pdf',
      icon: '📄',
      label: 'Save as PDF',
      detail: 'Opens the print dialog — choose “Save as PDF”.',
      action: () => run(() => printDocument(htmlDocument(html(), title)), 'Opening the print dialog…'),
    },
    {
      id: 'markdown',
      icon: '⬇️',
      label: 'Download text file',
      detail: 'A Markdown (.md) file — plain text that works in any app.',
      action: () =>
        run(() => downloadFile(`${fileBase}.md`, markdown(), 'text/markdown;charset=utf-8'), 'Downloaded the text file.'),
    },
  ]

  return (
    <Modal onClose={onClose} label={isAll ? 'Export all session notes' : 'Export session notes'}>
      <div className="export-notes">
        <h3 className="section-card__title">{isAll ? 'Export all session notes' : 'Export session notes'}</h3>
        <p className="export-notes__scope">
          {isAll ? (
            <>
              All <strong>{sessions.length}</strong> sessions, oldest first.
            </>
          ) : (
            <>
              <strong>{sessionTitle(sessions[0])}</strong>
            </>
          )}
        </p>

        <label className="export-notes__toggle">
          <input type="checkbox" checked={includeTags} onChange={(e) => setIncludeTags(e.target.checked)} />
          Add a list of the people, places, lore, loot and events tagged
        </label>

        <div className="export-notes__options">
          {options.map((option) => (
            <button key={option.id} type="button" className="export-option" onClick={option.action}>
              <span className="export-option__icon" aria-hidden="true">
                {option.icon}
              </span>
              <span className="export-option__text">
                <span className="export-option__label">{option.label}</span>
                <span className="export-option__detail">{option.detail}</span>
              </span>
            </button>
          ))}
        </div>

        <p
          className={`export-notes__status${status && !status.ok ? ' export-notes__status--error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {status?.message}
        </p>

        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ExportNotesDialog
