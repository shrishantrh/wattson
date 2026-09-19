import { useEffect, useState } from 'react'
import '../styles/yearslider.css'

// Year slider with play/pause. Advances one year per `speedMs` while playing and stops at the end.
export function useYearPlayback(years, { speedMs = 900 } = {}) {
  const [year, setYear] = useState(years[years.length - 1])
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return undefined
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setYear(years[years.length - 1]); setPlaying(false); return undefined }
    const id = setInterval(() => setYear(y => { const i = years.indexOf(y); if (i >= years.length - 1) { setPlaying(false); return y } return years[i + 1] }), speedMs)
    return () => clearInterval(id)
  }, [playing, years, speedMs])
  const play = () => { if (year === years[years.length - 1]) setYear(years[0]); setPlaying(true) }
  return { year, setYear, playing, setPlaying, play }
}

export default function YearSlider({ years, value, onChange, playing, onPlay, label }) {
  const i = Math.max(0, years.indexOf(value))
  return (
    <div className="ys">
      <button type="button" className="btn ys-play" onClick={() => onPlay(!playing)}>{playing ? 'Pause' : 'Play'}</button>
      <div className="ys-body">
        <div className="ys-top"><span className="ys-year">{value}</span>{label && <span className="ys-label">{label}</span>}</div>
        <input type="range" min={0} max={years.length - 1} step={1} value={i} onChange={e => { onPlay(false); onChange(years[Number(e.target.value)]) }} aria-label="Year" className={playing ? 'playing' : ''} style={{ '--ys-fill': `${(i / (years.length - 1)) * 100}%` }} />
        <div className="ys-ticks">{years.map(y => <span key={y} className={y === value ? 'on' : ''}>{String(y).slice(2)}</span>)}</div>
      </div>
    </div>
  )
}
