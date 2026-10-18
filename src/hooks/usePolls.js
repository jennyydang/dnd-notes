import { useCallback, useMemo } from 'react'
import { useCampaignData, useCampaignNav } from './useCampaignData.js'
import { notifyTableChanged, useSupabaseTable } from './useSupabaseTable.js'
import { getPlayerSession } from '../lib/auth.js'
import { cleanOptions, pollDecision, tallyPoll } from '../lib/polls.js'
import { supabase } from '../lib/supabaseClient.ts'

const pollFromRow = (r) => ({
  id: r.id,
  question: r.question,
  options: Array.isArray(r.options) ? r.options : [],
  createdBy: r.created_by,
  createdByName: r.created_by_name,
  status: r.status,
  result: r.result,
  closedAt: r.closed_at,
  createdAt: r.created_at,
})

const voteFromRow = (r) => ({
  id: r.id,
  pollId: r.poll_id,
  playerId: r.player_id,
  voterName: r.voter_name,
  optionIndex: r.option_index,
})

// The campaign's party polls, live: everyone's votes arrive as they're
// cast. Voting again changes your vote. Closing a poll (its creator or the
// DM) writes the decision into every member's quick notes, so it lands in
// each player's session recap at End Session.
export function usePolls() {
  const { campaignId, playerId } = useCampaignData()
  const { isDm } = useCampaignNav()
  const filters = useMemo(() => ({ campaign_id: campaignId }), [campaignId])
  const polls = useSupabaseTable('polls', { fromRow: pollFromRow, filters, orderBy: 'created_at', ascending: false })
  const votes = useSupabaseTable('poll_votes', { fromRow: voteFromRow, filters })
  const name = getPlayerSession()?.username || 'DM'

  const create = useCallback(
    async (question, options) => {
      const q = question.trim()
      const opts = cleanOptions(options)
      if (!q) throw new Error('Ask a question first.')
      if (opts.length < 2) throw new Error('Give at least two different choices.')
      return polls.addItem({ question: q, options: opts, created_by: playerId || null, created_by_name: name })
    },
    [polls, playerId, name],
  )

  const myVote = useCallback(
    (poll) => votes.items.find((v) => v.pollId === poll.id && v.playerId === playerId) || null,
    [votes.items, playerId],
  )

  const vote = useCallback(
    async (poll, optionIndex) => {
      if (!playerId || poll.status !== 'open') return
      navigator.vibrate?.(12)
      const existing = myVote(poll)
      if (existing) {
        if (existing.optionIndex !== optionIndex) await votes.updateItem(existing.id, { option_index: optionIndex })
        return
      }
      await votes.addItem({ poll_id: poll.id, player_id: playerId, voter_name: name, option_index: optionIndex })
    },
    [playerId, myVote, votes, name],
  )

  const canManage = useCallback((poll) => isDm || (playerId && poll.createdBy === playerId), [isDm, playerId])

  const close = useCallback(
    async (poll) => {
      const decision = pollDecision(poll, tallyPoll(poll, votes.items))
      await polls.updateItem(poll.id, { status: 'closed', result: decision, closed_at: new Date().toISOString() })
      // Into everyone's notes (the DM's too), so each recap carries it.
      const { data: members } = await supabase.from('campaign_members').select('player_id').eq('campaign_id', campaignId)
      const ids = [...new Set([...(members || []).map((m) => m.player_id), playerId].filter(Boolean))]
      if (ids.length) {
        const { error } = await supabase
          .from('quick_notes')
          .insert(ids.map((id) => ({ campaign_id: campaignId, player_id: id, content: decision })))
        if (error) throw new Error(`The vote closed, but it couldn’t be added to the notes: ${error.message}`)
        notifyTableChanged('quick_notes')
      }
      return decision
    },
    [polls, votes.items, campaignId, playerId],
  )

  const reopen = useCallback(
    (poll) => polls.updateItem(poll.id, { status: 'open', result: '', closed_at: null }),
    [polls],
  )

  const remove = useCallback((poll) => polls.removeItem(poll.id), [polls])

  return {
    polls: polls.items,
    votes: votes.items,
    loading: polls.loading,
    error: polls.error || votes.error,
    canVote: Boolean(playerId),
    playerId,
    create,
    vote,
    myVote,
    canManage,
    close,
    reopen,
    remove,
  }
}
