import { groupForChar } from './tags.js'

// Tags inside a plain-text quick note. A quick note is just text, so a tag
// (@person, #place, ~lore, $loot, %monster, !event) is stored as a token:
//
//   {{tag:@|<id>|<kind>|Old Marta}}
//
// It shows as a chip in the notes list, reads as "@Old Marta" anywhere
// that only wants text, and becomes a real tag chip when End Session turns
// the notes into a recap — so it lands in "People Met", the Timeline and
// the Connections web like one typed in the editor.

const TOKEN = /\{\{tag:([@#~$%!])\|([^|}]*)\|([^|}]*)\|([^}]*)\}\}/g
const clean = (s) => String(s ?? '').replace(/[|{}]/g, ' ').replace(/\s+/g, ' ').trim()

export function tagToken({ char, id, label, kind = '' }) {
  return `{{tag:${char}|${clean(id)}|${clean(kind)}|${clean(label)}}}`
}

// [{ text }] and [{ tag: { char, id, kind, label } }] pieces, in order.
export function splitNoteTags(content) {
  const text = String(content ?? '')
  const parts = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ tag: { char: m[1], id: m[2], kind: m[3], label: m[4] } })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

export const hasNoteTags = (content) => new RegExp(TOKEN.source).test(String(content ?? ''))

// "Met {{tag:@|…|Old Marta}}" → "Met @Old Marta".
export function noteTagsToPlain(content) {
  return String(content ?? '').replace(TOKEN, (_, char, _id, _kind, label) => `${char}${label}`)
}

// Back from the plain text a player edited: "@Old Marta" becomes its tag
// again wherever it's still there (a tag they deleted stays deleted).
export function plainToNoteTags(plainText, original) {
  let out = String(plainText ?? '')
  for (const part of splitNoteTags(original)) {
    if (!part.tag) continue
    const plain = `${part.tag.char}${part.tag.label}`
    const at = out.indexOf(plain)
    if (at >= 0) out = out.slice(0, at) + tagToken(part.tag) + out.slice(at + plain.length)
  }
  return out
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The recap editor's own tag markup (RichNotesEditor's mention node).
export function noteToRecapHtml(content) {
  return splitNoteTags(content)
    .map((part) => {
      if (part.text !== undefined) return escapeHtml(part.text)
      const { char, id, kind, label } = part.tag
      const group = groupForChar(char)
      return (
        `<span data-type="mention" class="mention mention--${group}" data-id="${escapeHtml(id)}"` +
        ` data-label="${escapeHtml(label)}" data-mention-suggestion-char="${escapeHtml(char)}"` +
        `${kind ? ` data-kind="${escapeHtml(kind)}"` : ''}>${escapeHtml(label)}</span>`
      )
    })
    .join('')
}
