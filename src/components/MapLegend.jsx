// The key to the campaign's hand-drawn maps: what each settlement mark
// and line style means. Swatches are drawn to match the maps, on a
// map-coloured tile so the white and grey marks read as they do there.
const SETTLEMENTS = [
  {
    label: 'Capital',
    swatch: <rect x="11" y="5" width="10" height="10" rx="1" fill="#fff" stroke="#4b5059" strokeWidth="1.6" />,
  },
  {
    label: 'Major / large city',
    swatch: <circle cx="16" cy="10" r="5.5" fill="#fff" stroke="#4b5059" strokeWidth="1.8" />,
  },
  { label: 'City', swatch: <circle cx="16" cy="10" r="3.8" fill="#fff" stroke="#6b7079" strokeWidth="1.4" /> },
  {
    label: 'Town / encampment',
    swatch: <circle cx="16" cy="10" r="2.4" fill="#fff" stroke="#c98582" strokeWidth="1.1" />,
  },
]

const ROUTES = [
  {
    label: 'Seafaring route',
    note: 'sometimes a stream or river',
    swatch: <line x1="2" y1="10" x2="30" y2="10" stroke="#fff" strokeWidth="2" strokeDasharray="5 3.5" />,
  },
  {
    label: 'Kingsroad',
    swatch: <line x1="2" y1="10" x2="30" y2="10" stroke="#e2703a" strokeWidth="3.6" strokeDasharray="6 4" />,
  },
  {
    label: 'Smaller road',
    swatch: <line x1="2" y1="10" x2="30" y2="10" stroke="#e2703a" strokeWidth="1.4" strokeDasharray="4 3" />,
  },
  {
    label: 'Trail',
    note: 'travelled enough to be mapped',
    swatch: (
      <line
        x1="3"
        y1="10"
        x2="30"
        y2="10"
        stroke="#6b7079"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="0 5"
      />
    ),
  },
]

// The app's own marks: the party's pin and the trail it leaves.
const PARTY = [
  {
    label: 'The party',
    swatch: (
      <g transform="translate(10 1.5) scale(0.7)" fill="none" stroke="#e8c766" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </g>
    ),
  },
  {
    label: 'Party journey',
    note: 'each stop, by session',
    swatch: (
      <g>
        <line x1="5" y1="13" x2="27" y2="7" stroke="#e8c766" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.5 4" />
        <circle cx="5" cy="13" r="2.6" fill="#e8c766" stroke="#171210" strokeWidth="1.2" />
        <circle cx="27" cy="7" r="2.6" fill="#e8c766" stroke="#171210" strokeWidth="1.2" />
      </g>
    ),
  },
]

function Row({ item }) {
  return (
    <li className="map-legend__row">
      <svg className="map-legend__swatch" viewBox="0 0 32 20" aria-hidden="true">
        {item.swatch}
      </svg>
      <span>
        {item.label}
        {item.note && <small>{item.note}</small>}
      </span>
    </li>
  )
}

// `children`: controls shown under the key (the journey toggle).
export default function MapLegend({ children }) {
  return (
    <section className="map-legend" aria-label="Map legend" onPointerDown={(e) => e.stopPropagation()}>
      <header className="map-legend__head">
        <h4>Legend</h4>
      </header>
      <h5>Settlements</h5>
      <ul>
        {SETTLEMENTS.map((item) => (
          <Row key={item.label} item={item} />
        ))}
      </ul>
      <h5>Routes</h5>
      <ul>
        {ROUTES.map((item) => (
          <Row key={item.label} item={item} />
        ))}
      </ul>
      <h5>Party</h5>
      <ul>
        {PARTY.map((item) => (
          <Row key={item.label} item={item} />
        ))}
      </ul>
      {children}
    </section>
  )
}
