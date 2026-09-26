import { supabase } from './supabaseClient.js'

// Tables scoped to the whole campaign.
const CAMPAIGN_TABLES = [
  'maps',
  'npcs',
  'places',
  'loot',
  'quests',
  'party_members',
  'party_goals',
  'lore_entries',
  'custom_tabs',
  'entity_links',
  'character_sheets',
]

// Private tables: exported for the logged-in player only (or everyone's,
// for the admin account, matching what the admin can already see).
const PLAYER_TABLES = [
  'session_notes',
  'quick_notes',
  'spells',
  'player_wallets',
  'player_shards',
  'session_prep',
]

async function selectAll(table, filters) {
  let query = supabase.from(table).select('*')
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

async function selectIn(table, column, ids) {
  if (!ids.length) return []
  const { data, error } = await supabase.from(table).select('*').in(column, ids)
  if (error) throw new Error(error.message)
  return data
}

function download(filename, contents) {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Downloads every row of the campaign as one JSON file (images stay in
// Supabase Storage; rows keep their object paths). A table that fails to
// load — e.g. one added by SQL that hasn't been run yet — is listed under
// `errors` instead of aborting the whole backup. Resolves to the number of
// rows exported.
export async function exportCampaign({ campaignId, campaignName, playerId }) {
  const backup = {
    format: 'adventurers-log-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    campaign: { id: campaignId, name: campaignName },
    tables: {},
    errors: {},
  }

  const campaignFilter = { campaign_id: campaignId }
  const playerFilter = playerId ? { campaign_id: campaignId, player_id: playerId } : campaignFilter

  const jobs = [
    ...CAMPAIGN_TABLES.map((table) => [table, () => selectAll(table, campaignFilter)]),
    ...PLAYER_TABLES.map((table) => [table, () => selectAll(table, playerFilter)]),
  ]
  await Promise.all(
    jobs.map(async ([table, run]) => {
      try {
        backup.tables[table] = await run()
      } catch (err) {
        backup.errors[table] = err.message
      }
    }),
  )

  // Child tables keyed by a parent id rather than campaign_id.
  const children = [
    ['custom_tab_entries', 'custom_tab_id', backup.tables.custom_tabs],
    ['map_markers', 'map_id', backup.tables.maps],
  ]
  for (const [table, column, parents] of children) {
    try {
      backup.tables[table] = await selectIn(table, column, (parents || []).map((p) => p.id))
    } catch (err) {
      backup.errors[table] = err.message
    }
  }
  if (playerId) {
    try {
      backup.tables.party_notes = await selectAll('party_notes', { author_player_id: playerId })
    } catch (err) {
      backup.errors.party_notes = err.message
    }
  }

  const count = Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0)
  const safeName = (campaignName || 'campaign').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  download(`${safeName || 'campaign'}-backup-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup, null, 2))
  return count
}
