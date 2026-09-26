// Forgiving client-side search over normalized campaign entries (see
// lib/entities.js). Every word of the query has to match somewhere in the
// entry — title, tags or body — but a word may match as a prefix, and a
// word of 4+ letters also matches a title word one typo away ("elandra" /
// "elandr" / "eladra"). Title hits outrank tag hits, which outrank body
// hits, so the thing you named floats to the top.

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function tokenize(value) {
  const normalized = normalizeText(value)
  return normalized ? normalized.split(' ') : []
}

// Damerau-style distance capped at 2 — only ever asked "is this within 1?".
export function withinOneEdit(a, b) {
  if (a === b) return true
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) return false
  let i = 0
  while (i < la && i < lb && a[i] === b[i]) i++
  if (la === lb) {
    // substitution, or adjacent transposition
    if (a.slice(i + 1) === b.slice(i + 1)) return true
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)
  }
  const [shorter, longer] = la < lb ? [a, b] : [b, a]
  return shorter.slice(i) === longer.slice(i + 1)
}

function scoreToken(token, fields) {
  const { titleWords, title, tags, body } = fields
  if (titleWords.some((w) => w === token)) return 12
  if (titleWords.some((w) => w.startsWith(token))) return 9
  if (title.includes(token)) return 6
  const nearTitle = (w) =>
    withinOneEdit(w, token) || (w.length > token.length && withinOneEdit(w.slice(0, token.length), token))
  if (token.length >= 4 && titleWords.some(nearTitle)) return 4
  if (tags.some((t) => t.startsWith(token))) return 5
  if (body.includes(token)) return 2
  return 0
}

// Returns the entries matching `query`, best first, each with `score`.
// An empty query matches everything (score 0) so filters alone still work.
export function searchEntities(entries, query, { types = null, sort = 'relevance' } = {}) {
  const tokens = tokenize(query)
  const typeSet = types && types.length ? new Set(types) : null
  const results = []

  for (const entry of entries) {
    if (typeSet && !typeSet.has(entry.type)) continue
    let score = 0
    if (tokens.length) {
      const title = normalizeText(entry.title)
      const fields = {
        title,
        titleWords: title.split(' '),
        tags: (entry.tags || []).map(normalizeText),
        body: normalizeText(`${entry.subtitle || ''} ${entry.body || ''}`),
      }
      let matchedAll = true
      for (const token of tokens) {
        const s = scoreToken(token, fields)
        if (!s) {
          matchedAll = false
          break
        }
        score += s
      }
      if (!matchedAll) continue
    }
    results.push({ ...entry, score })
  }

  const byTitle = (a, b) => a.title.localeCompare(b.title)
  const byRecent = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  if (sort === 'alpha') results.sort(byTitle)
  else if (sort === 'recent') results.sort(byRecent)
  else results.sort((a, b) => b.score - a.score || byRecent(a, b) || byTitle(a, b))
  return results
}

// Short excerpt of `body` around the first query word it contains, for
// showing why an entry matched.
export function snippet(body, query, length = 120) {
  const source = String(body || '').replace(/\s+/g, ' ').trim()
  if (!source) return ''
  const lower = source.toLowerCase()
  const token = tokenize(query).find((t) => lower.includes(t))
  if (!token) return source.length > length ? `${source.slice(0, length - 1)}…` : source
  const at = lower.indexOf(token)
  const start = Math.max(0, at - Math.floor(length / 3))
  const piece = source.slice(start, start + length)
  return `${start > 0 ? '…' : ''}${piece}${start + length < source.length ? '…' : ''}`
}
