import '../styles/shape.css'
import { SHAPES, FLEX_LABEL } from '../lib/shape.js'

// <ShapePicker value onChange shapes flexible onFlexible />
// A segmented control for the load shape plus a "flexible 20%" toggle. Controlled and stateless;
// small enough to sit inside an answer card. Omit onFlexible to hide the toggle.
export default function ShapePicker({ value, onChange, shapes = SHAPES, flexible = false, onFlexible }) {
  return (
    <div className="shape-picker">
      <div className="seg shape-seg" role="radiogroup" aria-label="Load shape">
        {shapes.map(s => (
          <button key={s.id} type="button" role="radio" aria-checked={s.id === value} className={s.id === value ? 'on' : ''} title={s.hint} onClick={() => onChange?.(s.id)}>{s.label}</button>
        ))}
      </div>
      {onFlexible && (
        <button type="button" className={`chip sm shape-flex${flexible ? ' on' : ''}`} aria-pressed={flexible} title="Move a fifth of the energy into the cleanest hours" onClick={() => onFlexible(!flexible)}>{FLEX_LABEL}</button>
      )}
    </div>
  )
}
