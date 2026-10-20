import { describe, expect, it } from 'vitest'
import { applyOps, coalesceOp, isNetworkError, matchesFilters, sortRows } from '../offline.js'
import { realtimeFilter } from '../realtime.js'

const insert = (rowId, payload, opId = `ins-${rowId}`) => ({
  opId,
  table: 'npcs',
  kind: 'insert',
  rowId,
  payload: { id: rowId, ...payload },
  local: { created_at: '2026-10-14T10:00:00Z', id: rowId, ...payload },
})
const update = (rowId, payload, opId = `upd-${rowId}-${Math.random()}`) => ({ opId, table: 'npcs', kind: 'update', rowId, payload })
const remove = (rowId, opId = `del-${rowId}`) => ({ opId, table: 'npcs', kind: 'delete', rowId })

describe('coalesceOp', () => {
  it('folds an update into the queued insert of the same row, payload and local copy', () => {
    const ops = coalesceOp([insert('a', { name: 'Ismark' })], update('a', { name: 'Ismark the Lesser' }))
    expect(ops).toHaveLength(1)
    expect(ops[0].payload.name).toBe('Ismark the Lesser')
    expect(ops[0].local.name).toBe('Ismark the Lesser')
  })

  it('merges consecutive updates to the same row', () => {
    const ops = coalesceOp([update('a', { name: 'X' })], update('a', { status: 'Alive' }))
    expect(ops).toEqual([expect.objectContaining({ kind: 'update', payload: { name: 'X', status: 'Alive' } })])
  })

  it('drops everything for a row created and deleted while offline', () => {
    const ops = coalesceOp([insert('a', {}), update('b', { n: 1 })], remove('a'))
    expect(ops.map((o) => o.rowId)).toEqual(['b'])
  })

  it('replaces queued updates with the delete for a row that already existed', () => {
    const ops = coalesceOp([update('a', { n: 1 })], remove('a'))
    expect(ops).toEqual([expect.objectContaining({ kind: 'delete', rowId: 'a' })])
  })

  it('never changes or drops the write that is being sent', () => {
    const sending = insert('a', { name: 'Ireena' }, 'sending')
    const updated = coalesceOp([sending], update('a', { name: 'Tatyana' }), 'sending')
    expect(updated).toHaveLength(2)
    expect(updated[0]).toBe(sending)

    const deleted = coalesceOp([sending], remove('a'), 'sending')
    expect(deleted.map((o) => o.kind)).toEqual(['insert', 'delete'])
  })

  it('keeps tables apart', () => {
    const other = { ...update('a', { n: 1 }), table: 'loot' }
    expect(coalesceOp([other], update('a', { n: 2 }))).toHaveLength(2)
  })
})

describe('applyOps', () => {
  const rows = [
    { id: 'a', name: 'Ismark', campaign_id: 'c1', created_at: '2026-10-01' },
    { id: 'b', name: 'Ireena', campaign_id: 'c1', created_at: '2026-10-02' },
  ]
  const opts = { table: 'npcs', filters: { campaign_id: 'c1' }, orderBy: 'created_at', ascending: true }

  it('adds queued inserts that match the filters, in order', () => {
    const result = applyOps(rows, [insert('c', { name: 'Eva', campaign_id: 'c1' })], opts)
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('skips inserts for another campaign, and rows already loaded', () => {
    const ops = [insert('c', { campaign_id: 'c2' }), insert('a', { campaign_id: 'c1' })]
    expect(applyOps(rows, ops, opts)).toBe(rows)
  })

  it('applies updates and deletes', () => {
    const result = applyOps(rows, [update('a', { name: 'Ismark K.' }), remove('b')], opts)
    expect(result).toEqual([{ ...rows[0], name: 'Ismark K.' }])
  })

  it('ignores other tables', () => {
    expect(applyOps(rows, [{ ...remove('a'), table: 'loot' }], opts)).toBe(rows)
  })
})

describe('matchesFilters / sortRows', () => {
  it('treats array filters as "one of"', () => {
    expect(matchesFilters({ map_id: 'm2' }, { map_id: ['m1', 'm2'] })).toBe(true)
    expect(matchesFilters({ map_id: 'm3' }, { map_id: ['m1', 'm2'] })).toBe(false)
  })

  it('sorts descending with blanks last', () => {
    const sorted = sortRows([{ d: '2026-01' }, { d: null }, { d: '2026-03' }], 'd', false)
    expect(sorted.map((r) => r.d)).toEqual(['2026-03', '2026-01', null])
  })
})

describe('isNetworkError', () => {
  it('recognises fetch failures but not server errors', () => {
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true)
    expect(isNetworkError({ message: 'Load failed' })).toBe(true)
    expect(isNetworkError({ message: 'new row violates check constraint' })).toBe(false)
  })
})

describe('realtimeFilter', () => {
  it('uses the first single-value filter', () => {
    expect(realtimeFilter({ campaign_id: 'c1', player_id: 'p1' })).toBe('campaign_id=eq.c1')
  })

  it('uses an "in" filter for a list of ids', () => {
    expect(realtimeFilter({ map_id: ['m1', 'm2'] })).toBe('map_id=in.(m1,m2)')
  })

  it('subscribes to nothing when the list is empty', () => {
    expect(realtimeFilter({ map_id: [] })).toBeNull()
  })

  it('falls back to the whole table for long lists or no filters', () => {
    expect(realtimeFilter({ map_id: Array.from({ length: 101 }, (_, i) => `m${i}`) })).toBe('')
    expect(realtimeFilter({})).toBe('')
  })
})
