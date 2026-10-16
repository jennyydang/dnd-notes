import { TAG_GROUPS } from './tags.js'
import { extractMentions, toEditorContent } from './richNotes.js'
import { formatSessionDate, sessionDateTimestamp } from './sessionNotes.js'

// Turns session recaps (editor HTML, or plain text from older rows) into
// formats other apps take: Markdown for ChatGPT and other chat tools,
// clean HTML for Word / Google Docs / PDF. Tag chips become their plain
// names, so nothing app-specific leaks into the copy.

const SUMMARY_GROUPS = [
  ['person', 'People'],
  ['place', 'Places'],
  ['lore', 'Lore'],
  ['loot', 'Loot'],
  ['creature', 'Monsters'],
  ['event', 'Events'],
]

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseBody(notes) {
  return new DOMParser().parseFromString(toEditorContent(notes || ''), 'text/html').body
}

export function sessionTitle(session) {
  return session.title?.trim() || 'Untitled Session'
}

// Oldest first, so an export of everything reads like a story.
export function sortChronologically(sessions) {
  return [...sessions].sort(
    (a, b) =>
      sessionDateTimestamp(a.sessionDate) - sessionDateTimestamp(b.sessionDate) ||
      new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
  )
}

// ── Markdown ─────────────────────────────────────────────────────────────

function inlineMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const tag = node.tagName.toLowerCase()
  if (tag === 'br') return '\n'
  if (node.getAttribute('data-type') === 'mention') return node.getAttribute('data-label') || node.textContent
  const inner = [...node.childNodes].map(inlineMarkdown).join('')
  if (!inner.trim()) return inner
  if (tag === 'strong' || tag === 'b') return `**${inner}**`
  if (tag === 'em' || tag === 'i') return `*${inner}*`
  if (tag === 's' || tag === 'del' || tag === 'strike') return `~~${inner}~~`
  return inner
}

function blockMarkdown(node, depth = 0) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim() ? [node.textContent.trim()] : []
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const tag = node.tagName.toLowerCase()
  if (tag === 'ul' || tag === 'ol') {
    const lines = []
    ;[...node.children].forEach((li, index) => {
      const marker = tag === 'ol' ? `${index + 1}.` : '-'
      const indent = '  '.repeat(depth)
      const own = [...li.childNodes].filter((c) => !['UL', 'OL'].includes(c.nodeName))
      const text = own
        .map(inlineMarkdown)
        .join(' ')
        .trim()
      lines.push(`${indent}${marker} ${text}`)
      for (const nested of li.querySelectorAll(':scope > ul, :scope > ol')) lines.push(...blockMarkdown(nested, depth + 1))
    })
    return [lines.join('\n')]
  }
  if (tag === 'p' || /^h\d$/.test(tag)) {
    const text = inlineMarkdown(node).trim()
    return text ? [text] : []
  }
  return [...node.childNodes].flatMap((c) => blockMarkdown(c, depth))
}

export function notesToMarkdown(notes) {
  return blockMarkdown(parseBody(notes)).join('\n\n')
}

function summaryLines(notes) {
  const mentions = extractMentions(toEditorContent(notes || ''))
  return SUMMARY_GROUPS.filter(([group]) => mentions[group]?.length).map(
    ([group, label]) => [label, TAG_GROUPS[group].icon, mentions[group].map((m) => m.label)],
  )
}

function sessionMarkdown(session, { includeTags, headingLevel }) {
  const hashes = '#'.repeat(headingLevel)
  const parts = [`${hashes} ${sessionTitle(session)}`]
  if (session.sessionDate) parts.push(`*${formatSessionDate(session.sessionDate)}*`)
  const body = notesToMarkdown(session.notes)
  parts.push(body || '_No notes._')
  if (includeTags) {
    const summary = summaryLines(session.notes)
    if (summary.length) {
      parts.push(summary.map(([label, , names]) => `**${label}:** ${names.join(', ')}`).join('  \n'))
    }
  }
  return parts.join('\n\n')
}

// One session, or a whole campaign's worth under a single title.
export function sessionsToMarkdown(sessions, { title, includeTags = true } = {}) {
  if (sessions.length === 1 && !title) return sessionMarkdown(sessions[0], { includeTags, headingLevel: 1 })
  const sections = sessions.map((s) => sessionMarkdown(s, { includeTags, headingLevel: 2 }))
  return `# ${title || 'Session Notes'}\n\n${sections.join('\n\n---\n\n')}`
}

// ── HTML (Word, Google Docs, PDF) ────────────────────────────────────────

function cleanInlineHtml(node) {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent)
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const tag = node.tagName.toLowerCase()
  if (tag === 'br') return '<br>'
  if (node.getAttribute('data-type') === 'mention') {
    return `<strong>${escapeHtml(node.getAttribute('data-label') || node.textContent)}</strong>`
  }
  const inner = [...node.childNodes].map(cleanInlineHtml).join('')
  if (['strong', 'b', 'em', 'i', 's', 'u'].includes(tag)) return `<${tag}>${inner}</${tag}>`
  if (tag === 'del' || tag === 'strike') return `<s>${inner}</s>`
  return inner
}

function cleanBlockHtml(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim() ? `<p>${escapeHtml(node.textContent)}</p>` : ''
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const tag = node.tagName.toLowerCase()
  if (tag === 'ul' || tag === 'ol') {
    const items = [...node.children]
      .map((li) => {
        const own = [...li.childNodes]
          .filter((c) => !['UL', 'OL'].includes(c.nodeName))
          .map(cleanInlineHtml)
          .join(' ')
        const nested = [...li.querySelectorAll(':scope > ul, :scope > ol')].map(cleanBlockHtml).join('')
        return `<li>${own}${nested}</li>`
      })
      .join('')
    return `<${tag}>${items}</${tag}>`
  }
  if (tag === 'p') return `<p>${cleanInlineHtml(node) || '&nbsp;'}</p>`
  return [...node.childNodes].map(cleanBlockHtml).join('')
}

function sessionHtml(session, { includeTags, headingTag }) {
  let html = `<${headingTag}>${escapeHtml(sessionTitle(session))}</${headingTag}>`
  if (session.sessionDate) html += `<p><em>${escapeHtml(formatSessionDate(session.sessionDate))}</em></p>`
  html += cleanBlockHtml(parseBody(session.notes)) || '<p><em>No notes.</em></p>'
  if (includeTags) {
    const summary = summaryLines(session.notes)
    if (summary.length) {
      html += `<p>${summary
        .map(([label, , names]) => `<strong>${label}:</strong> ${escapeHtml(names.join(', '))}`)
        .join('<br>')}</p>`
    }
  }
  return html
}

// A fragment (no <html> wrapper) — what goes on the clipboard.
export function sessionsToHtml(sessions, { title, includeTags = true } = {}) {
  if (sessions.length === 1 && !title) return sessionHtml(sessions[0], { includeTags, headingTag: 'h1' })
  return `<h1>${escapeHtml(title || 'Session Notes')}</h1>${sessions
    .map((s) => sessionHtml(s, { includeTags, headingTag: 'h2' }))
    .join('<hr>')}`
}

// A full standalone document, for the .doc download and the print view.
export function htmlDocument(bodyHtml, title) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #111; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 20pt; margin: 0 0 0.5rem; }
  h2 { font-size: 15pt; margin: 1.5rem 0 0.25rem; }
  hr { border: 0; border-top: 1px solid #bbb; margin: 1.5rem 0; }
  @media print { body { margin: 0; } h2 { break-after: avoid; } }
</style></head><body>${bodyHtml}</body></html>`
}

// ── Delivery ─────────────────────────────────────────────────────────────

export function safeFileName(name) {
  return (name || 'session-notes').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'session-notes'
}

export function downloadFile(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Rich copy keeps headings and bold when pasted into Word or Google Docs;
// apps that only take text get the Markdown/plain version.
export async function copyRich(html, text) {
  if (window.ClipboardItem && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new window.ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ])
    return
  }
  await copyText(text)
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Older browsers / non-secure contexts.
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('Your browser blocked copying.')
}

// Prints the notes on their own (not the app around them); the browser's
// print dialog has "Save as PDF". Uses a hidden iframe so no pop-up
// blocker gets in the way.
export function printDocument(fullHtml) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  doc.open()
  doc.write(fullHtml)
  doc.close()
  const win = frame.contentWindow
  const cleanup = () => setTimeout(() => frame.remove(), 1000)
  win.addEventListener('afterprint', cleanup)
  setTimeout(() => {
    win.focus()
    win.print()
    // Some browsers never fire afterprint; don't leave the frame forever.
    setTimeout(cleanup, 60000)
  }, 250)
}
