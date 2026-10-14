import './Ambience.scss'

const EMBERS = 18

// A fixed pseudo-random spread, so the embers look scattered but never
// jump around between renders.
const rand = (i, salt) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

const embers = Array.from({ length: EMBERS }, (_, i) => ({
  '--x': `${(rand(i, 1) * 100).toFixed(1)}vw`,
  '--drift': `${((rand(i, 2) - 0.5) * 18).toFixed(1)}vw`,
  '--size': `${(2 + rand(i, 3) * 3).toFixed(1)}px`,
  '--duration': `${(11 + rand(i, 4) * 12).toFixed(1)}s`,
  '--delay': `${(-rand(i, 5) * 22).toFixed(1)}s`,
}))

// The living background: embers drifting up and slow fog behind every
// screen. Combat mode turns the embers red and quicker. Pure CSS
// transforms, so it costs very little; Settings → Ambience can tone it
// down or switch it off, and reduced-motion turns it off.
function Ambience() {
  return (
    <div className="ambience" aria-hidden="true">
      <div className="ambience__fog ambience__fog--one" />
      <div className="ambience__fog ambience__fog--two" />
      <div className="ambience__embers">
        {embers.map((style, i) => (
          <span key={i} style={style} />
        ))}
      </div>
      <div className="ambience__vignette" />
    </div>
  )
}

export default Ambience
