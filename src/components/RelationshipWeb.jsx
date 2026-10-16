import { useEffect, useMemo, useRef, useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { WEB_TYPES, buildRelationshipWeb, neighbours } from '../lib/relationshipWeb.js'
import { bounds, seedPositions, step } from '../lib/forceLayout.js'
import Icon from './Icon.jsx'
import { attitudeInfo } from '../lib/attitude.js'
import './RelationshipWeb.scss'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const TAP_PX = 5
const radius = (n) => (n.hub ? 24 : Math.min(22, 7 + Math.sqrt(n.degree) * 3.2))
const clampZoom = (k) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))

// The Connections tab: everyone and everything the party has tied
// together, as a web that settles into place. Drag the background to pan,
// pinch / scroll to zoom, drag a node to move it; tap one to light up its
// connections and see why they're connected.
function RelationshipWeb() {
  const { entities, links, loading } = useCampaignData()
  const nav = useCampaignNav()
  const [hiddenTypes, setHiddenTypes] = useState(() => new Set())
  const [showLoose, setShowLoose] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [size, setSize] = useState(null) // the canvas, once measured
  const [, setFrame] = useState(0)

  const full = useMemo(() => buildRelationshipWeb(entities, links), [entities, links])
  const web = useMemo(() => {
    const nodes = full.nodes.filter((n) => !hiddenTypes.has(n.type))
    const keys = new Set(nodes.map((n) => n.key))
    const edges = full.edges.filter((e) => keys.has(e.a) && keys.has(e.b))
    const linked = new Set(edges.flatMap((e) => [e.a, e.b]))
    return { nodes: showLoose ? nodes : nodes.filter((n) => linked.has(n.key)), edges }
  }, [full, hiddenTypes, showLoose])

  const wrapRef = useRef(null)
  const positions = useRef(new Map())
  const alpha = useRef(0)
  const frame = useRef(null)
  const fitted = useRef(false)
  const viewRef = useRef(view)
  viewRef.current = view
  const sizeRef = useRef(size)
  sizeRef.current = size || { w: 800, h: 560 }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width && height) setSize({ w: width, h: height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function fit(nodes = web.nodes) {
    const b = bounds(nodes, positions.current)
    const { w, h } = sizeRef.current
    const pad = 60
    const k = clampZoom(Math.min((w - pad * 2) / Math.max(1, b.maxX - b.minX), (h - pad * 2) / Math.max(1, b.maxY - b.minY), 1.4))
    setView({ k, x: w / 2 - ((b.minX + b.maxX) / 2) * k, y: h / 2 - ((b.minY + b.maxY) / 2) * k })
  }

  function centerOn(key) {
    const p = positions.current.get(key)
    if (!p) return
    const { w, h } = sizeRef.current
    const k = Math.max(viewRef.current.k, 1)
    // On a phone the details sheet covers the lower part of the canvas.
    const y = w < 720 ? h * 0.3 : h / 2
    setView({ k, x: (w < 720 ? w / 2 : (w - 320) / 2) - p.x * k, y: y - p.y * k })
  }

  function heat(amount) {
    alpha.current = Math.max(alpha.current, amount)
    if (frame.current) return
    const tick = () => {
      step(web.nodes, web.edges, positions.current, alpha.current)
      alpha.current *= 0.965
      setFrame((f) => f + 1)
      frame.current = alpha.current > 0.02 ? requestAnimationFrame(tick) : null
    }
    frame.current = requestAnimationFrame(tick)
  }

  // A new or changed web: keep where known nodes are, place new ones,
  // and let it settle (pre-settled a little, so it doesn't start as a ring).
  useEffect(() => {
    positions.current = seedPositions(web.nodes, positions.current)
    const first = !fitted.current && web.nodes.length > 0
    if (first) {
      for (let i = 0; i < 160; i++) step(web.nodes, web.edges, positions.current, 1 - i / 200)
      if (size) {
        fit()
        fitted.current = true
      }
    }
    heat(first ? 0.35 : 0.6)
    return () => {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web])

  // Fit once the canvas has its real size (the web may have loaded first).
  useEffect(() => {
    if (size && !fitted.current && web.nodes.length) {
      fit()
      fitted.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  // ── Pointer handling: pan, pinch-zoom, node drag, tap to select ──
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  const toWorld = (clientX, clientY) => {
    const rect = wrapRef.current.getBoundingClientRect()
    const v = viewRef.current
    return { x: (clientX - rect.left - v.x) / v.k, y: (clientY - rect.top - v.y) / v.k }
  }

  function onPointerDown(e) {
    if (e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const nodeKey = e.target.closest('[data-node]')?.dataset.node || null
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: viewRef.current }
      return
    }
    gesture.current = { kind: nodeKey ? 'node' : 'pan', key: nodeKey, start: { x: e.clientX, y: e.clientY }, view: viewRef.current, moved: false }
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()]
      const rect = wrapRef.current.getBoundingClientRect()
      const k = clampZoom(g.view.k * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist))
      const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top }
      const startMid = { x: g.mid.x - rect.left, y: g.mid.y - rect.top }
      const wx = (startMid.x - g.view.x) / g.view.k
      const wy = (startMid.y - g.view.y) / g.view.k
      setView({ k, x: mid.x - wx * k, y: mid.y - wy * k })
      return
    }
    const dx = e.clientX - g.start.x
    const dy = e.clientY - g.start.y
    if (!g.moved && Math.hypot(dx, dy) < TAP_PX) return
    g.moved = true
    if (g.kind === 'pan') {
      setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy })
    } else {
      const p = positions.current.get(g.key)
      if (!p) return
      const w = toWorld(e.clientX, e.clientY)
      p.x = w.x
      p.y = w.y
      p.fixed = true
      heat(0.25)
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null
      return
    }
    gesture.current = null
    if (g.kind === 'node') {
      const p = positions.current.get(g.key)
      if (p) p.fixed = false
      if (!g.moved) {
        const next = selected === g.key ? null : g.key
        setSelected(next)
        // Bring it out from under the details panel (or the phone's sheet).
        const p = next && positions.current.get(next)
        if (p) {
          const { w } = sizeRef.current
          const sx = p.x * viewRef.current.k + viewRef.current.x
          if (w < 720 || sx > w - 340) centerOn(next)
        }
      }
    } else if (!g.moved) {
      setSelected(null)
    }
  }

  // Wheel / trackpad: pinch (ctrl+wheel) zooms at the cursor, two-finger
  // scroll pans — the same as on an iPad.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    function onWheel(e) {
      e.preventDefault()
      const v = viewRef.current
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        const k = clampZoom(v.k * Math.exp(-e.deltaY * 0.01))
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        setView({ k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k })
      } else {
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function zoomBy(factor) {
    const v = viewRef.current
    const { w, h } = sizeRef.current
    const k = clampZoom(v.k * factor)
    setView({ k, x: w / 2 - ((w / 2 - v.x) / v.k) * k, y: h / 2 - ((h / 2 - v.y) / v.k) * k })
  }

  // ── What's lit up ──
  const focus = selected || hovered
  const near = useMemo(() => {
    if (!focus) return null
    const set = new Set([focus])
    for (const e of web.edges) {
      if (e.a === focus) set.add(e.b)
      if (e.b === focus) set.add(e.a)
    }
    return set
  }, [focus, web.edges])

  const q = query.trim().toLowerCase()
  const matches = q ? web.nodes.filter((n) => n.label.toLowerCase().includes(q)) : []
  const matchKeys = new Set(matches.map((n) => n.key))

  const selectedNode = selected ? web.nodes.find((n) => n.key === selected) : null
  const connections = selectedNode ? neighbours(web, selectedNode.key) : []
  const maxWeight = Math.max(1, ...web.edges.map((e) => e.weight))

  useEffect(() => {
    if (selected && !web.nodes.some((n) => n.key === selected)) setSelected(null)
  }, [web, selected])

  function pick(key) {
    setSelected(key)
    centerOn(key)
  }

  const counts = Object.fromEntries(Object.keys(WEB_TYPES).map((t) => [t, full.nodes.filter((n) => n.type === t).length]))
  const looseCount = full.nodes.filter((n) => n.degree === 0 && !hiddenTypes.has(n.type)).length

  return (
    <div className="web">
      <div className="web__toolbar">
        <label className="web__search">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            placeholder="Find someone or something…"
            aria-label="Find in the web"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) pick(matches[0].key)
            }}
          />
          {q && <span className="web__matches">{matches.length}</span>}
        </label>
        <div className="web__filters" role="group" aria-label="Show">
          {Object.entries(WEB_TYPES).map(([type, def]) =>
            counts[type] ? (
              <button
                key={type}
                type="button"
                className={`chip web__chip${hiddenTypes.has(type) ? '' : ' chip--active'}`}
                aria-pressed={!hiddenTypes.has(type)}
                onClick={() =>
                  setHiddenTypes((all) => {
                    const next = new Set(all)
                    if (next.has(type)) next.delete(type)
                    else next.add(type)
                    return next
                  })
                }
              >
                <span className="web__dot" style={{ background: def.color }} aria-hidden="true" />
                {def.label}
              </button>
            ) : null,
          )}
          {looseCount > 0 && (
            <button type="button" className={`chip${showLoose ? ' chip--active' : ''}`} aria-pressed={showLoose} onClick={() => setShowLoose((s) => !s)}>
              Unconnected ({looseCount})
            </button>
          )}
        </div>
      </div>

      <div
        ref={wrapRef}
        className={`web__canvas panel${gesture.current?.moved ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!loading && web.nodes.length === 0 ? (
          <div className="web__empty">
            <Icon name="network" />
            <p>
              <strong>Nothing connected yet.</strong> Tag people, places and lore in your session recaps with{' '}
              <kbd>@</kbd>, <kbd>#</kbd> and <kbd>~</kbd> — anything tagged in the same paragraph is connected here, along
              with links between entries, who gave each quest, and who holds what.
            </p>
          </div>
        ) : (
          <svg className="web__svg" width={sizeRef.current.w} height={sizeRef.current.h} role="img" aria-label="Relationship web">
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {web.edges.map((e) => {
                const a = positions.current.get(e.a)
                const b = positions.current.get(e.b)
                if (!a || !b) return null
                const lit = focus && (e.a === focus || e.b === focus)
                return (
                  <line
                    key={e.id}
                    className={`web__edge${lit ? ' is-lit' : ''}${near && !lit ? ' is-dim' : ''}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    strokeWidth={(1 + (e.weight / maxWeight) * 3) / Math.sqrt(view.k)}
                  />
                )
              })}
              {web.nodes.map((n) => {
                const p = positions.current.get(n.key)
                if (!p) return null
                const r = radius(n)
                const dim = (near && !near.has(n.key)) || (q && !matchKeys.has(n.key))
                const showLabel = n.hub || n.degree >= 3 || view.k > 1.1 || near?.has(n.key) || matchKeys.has(n.key)
                return (
                  <g
                    key={n.key}
                    data-node={n.key}
                    className={`web__node${n.hub ? ' web__node--hub' : ''}${selected === n.key ? ' is-selected' : ''}${dim ? ' is-dim' : ''}${matchKeys.has(n.key) ? ' is-match' : ''}`}
                    transform={`translate(${p.x} ${p.y})`}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(n.key)}
                    onPointerLeave={() => setHovered(null)}
                  >
                    <circle r={r + 5} className="web__halo" />
                    {/* An NPC's ring shows how they feel about the party. */}
                    {attitudeInfo(n.entity.raw?.attitude) && n.type === 'npc' && (
                      <circle r={r + 2.5} className="web__attitude" stroke={attitudeInfo(n.entity.raw.attitude).color} />
                    )}
                    <circle r={r} fill={WEB_TYPES[n.type].color} className="web__dot-node" />
                    {showLabel && (
                      <text className="web__label" y={r + 13} fontSize={12 / Math.sqrt(view.k)}>
                        {n.label}
                      </text>
                    )}
                    <title>{`${n.label} — ${n.degree} connection${n.degree === 1 ? '' : 's'}`}</title>
                  </g>
                )
              })}
            </g>
          </svg>
        )}

        <div className="web__zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="icon-btn" aria-label="Zoom in" onClick={() => zoomBy(1.3)}>
            <Icon name="plus" />
          </button>
          <button type="button" className="icon-btn" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.3)}>
            <Icon name="minus" />
          </button>
          <button type="button" className="icon-btn" aria-label="Fit everything" onClick={() => fit()}>
            <Icon name="maximize" />
          </button>
        </div>

        {selectedNode && (
          <aside className="web__panel panel" aria-label={`${selectedNode.label}’s connections`} onPointerDown={(e) => e.stopPropagation()}>
            <header className="web__panel-head">
              <span className="web__dot web__dot--big" style={{ background: WEB_TYPES[selectedNode.type].color }} aria-hidden="true" />
              <div>
                <span className="web__panel-kind">
                  {selectedNode.entity.label}
                  {selectedNode.type === 'npc' && selectedNode.entity.raw?.attitude && (
                    <span style={{ color: attitudeInfo(selectedNode.entity.raw.attitude)?.color }}>
                      {' '}· {selectedNode.entity.raw.attitude}
                    </span>
                  )}
                </span>
                <h3>{selectedNode.label}</h3>
              </div>
              <button type="button" className="btn web__open" onClick={() => (selectedNode.hub ? nav.goTo('party') : nav.openEntity(selectedNode.type, selectedNode.id))}>
                Open
              </button>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setSelected(null)}>
                <Icon name="close" />
              </button>
            </header>
            <p className="web__panel-count">
              {connections.length} connection{connections.length === 1 ? '' : 's'}
            </p>
            <ul className="web__connections">
              {connections.map(({ node, edge }) => (
                <li key={node.key}>
                  <button type="button" className="web__connection" onClick={() => pick(node.key)}>
                    <span className="web__dot" style={{ background: WEB_TYPES[node.type].color }} aria-hidden="true" />
                    <span className="web__connection-text">
                      <strong>{node.label}</strong>
                      <span>
                        {edge.reasons.slice(0, 2).join(' · ')}
                        {edge.reasons.length > 2 && ` · +${edge.reasons.length - 2} more`}
                      </span>
                    </span>
                    {edge.weight > 1 && <span className="web__weight">×{edge.weight}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      <p className="web__hint">Drag to move around · pinch or scroll to zoom · tap a dot to see its connections</p>
    </div>
  )
}

export default RelationshipWeb
