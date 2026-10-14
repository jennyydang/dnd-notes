import { supabase } from './supabaseClient.js'

const EXCERPT_CHARS = 160

const excerpt = (text) => {
  const clean = text.trim().replace(/\s+/g, ' ')
  return clean.length > EXCERPT_CHARS ? `${clean.slice(0, EXCERPT_CHARS - 1)}…` : clean
}

// Adds a notification to a player's bell. It reaches an open app live
// (Realtime) or shows next time they open it.
export async function notifyPlayer(playerId, { kind = 'general', title, body = '' }) {
  const { error } = await supabase.from('notifications').insert({ player_id: playerId, kind, title, body })
  if (error) throw new Error(error.message)
}

// The notification a player gets when the admin marks their feedback solved.
export function feedbackSolvedNotice(item) {
  return {
    kind: 'feedback_solved',
    title: item.kind === 'issue' ? 'The issue you reported is solved' : 'Your suggestion is done',
    body: `“${excerpt(item.message)}”`,
  }
}
