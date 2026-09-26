// Session recaps are stored as HTML produced by the rich-text editor
// (RichNotesEditor.jsx). Rows written before that editor existed hold
// plain text instead — these helpers let both shapes be read the same way.

// The editor never produces anything but tags at the top level, so a
// leading "<" is a reliable enough marker for "already HTML".
function isHtml(notes) {
  return notes.trimStart().startsWith('<')
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Plain text → one paragraph per line, so old recaps keep their line
// breaks when first opened in the editor.
export function toEditorContent(notes) {
  if (!notes) return ''
  if (isHtml(notes)) return notes
  return notes
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

// DOMParser builds an inert document — nothing in it runs or loads — so
// it's safe to feed stored HTML through just to read text back out.
function parse(notes) {
  return new DOMParser().parseFromString(notes, 'text/html')
}

// Text-only rendering for places that show a recap as a plain preview
// (e.g. the session list cards). Block elements become line breaks.
export function notesToPlainText(notes) {
  if (!notes || !isHtml(notes)) return notes || ''
  const doc = parse(notes)
  return [...doc.body.querySelectorAll('p, li')]
    .map((el) => el.textContent)
    .join('\n')
    .trim()
}

// Every person (@) and place (#) tagged in a recap, de-duplicated by id,
// in the order they first appear.
export function extractMentions(notes) {
  const people = new Map()
  const places = new Map()
  if (!notes || !isHtml(notes)) return { people: [], places: [] }

  for (const el of parse(notes).querySelectorAll('span[data-type="mention"]')) {
    const id = el.getAttribute('data-id')
    const label = el.getAttribute('data-label') || el.textContent
    if (!id) continue
    const target = el.getAttribute('data-mention-suggestion-char') === '#' ? places : people
    if (!target.has(id)) target.set(id, { id, label })
  }
  return { people: [...people.values()], places: [...places.values()] }
}
