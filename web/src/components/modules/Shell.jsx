/* oxlint-disable react/only-export-components -- TONES is a plain lookup shared with the views */
import { useState } from 'react'
import '../../styles/modules.css'

// The anatomy every evidence module card shares, so the stack reads as one thing:
//
//   <Mod caption=… lead={<Lead …/>} foot=…>   content   </Mod>
//
//   title     the 12px muted row with the drag handle and hide control. Workspace draws it;
//             modules never draw their own title.
//   caption   one line, 12px muted: what this card is. Optional.
//   lead      the one number or the one sentence, before any detail. Every module has one.
//   content   the detail.
//   foot      11px muted source note, above a hairline: "EIA-930 hourly via PUDL, 2025",
//             "hand-mapped", a page cite. Every module has one.
//
// Tone words are semantic, never decorative: `fossil` is the ember (the thing being burned),
// `clean` the cool cyan-teal, `pos`/`neg`/`warn` the outcome ramp, everything else neutral grey.
// The colours are tokens.css's; the fallbacks here only cover the window before those tokens land.

export const TONES = ['fossil', 'clean', 'pos', 'neg', 'warn']
const tone = t => (TONES.includes(t) ? ` ${t}` : '')

export function Mod({ caption, lead, foot, className = '', children }) {
  return (
    <div className={`mod${className ? ` ${className}` : ''}`}>
      {caption && <p className="mod-cap">{caption}</p>}
      {lead}
      {children}
      {foot && <p className="mod-foot">{foot}</p>}
    </div>
  )
}

// The one number. `value` is already formatted (mono, tabular); `label` says what it is.
// `aside` is an optional second figure of equal standing, `t` its tone.
export function Lead({ value, label, t, aside, asideLabel, asideTone }) {
  return (
    <div className="mod-lead">
      <div className="mod-lead-one">
        <div className={`mod-lead-v${tone(t)}`}>{value}</div>
        {label && <div className="mod-lead-l">{label}</div>}
      </div>
      {aside != null && (
        <div className="mod-lead-one">
          <div className={`mod-lead-v${tone(asideTone)}`}>{aside}</div>
          {asideLabel && <div className="mod-lead-l">{asideLabel}</div>}
        </div>
      )}
    </div>
  )
}

// The one sentence, for cards whose lead is words rather than a figure.
export function Say({ children }) {
  return <p className="mod-say">{children}</p>
}

// Empty and unavailable states: one muted line, never a blank box.
export function Empty({ children }) {
  return <p className="mod-empty">{children}</p>
}

// A small label in the muted 11px voice, for a caption row that carries a chip.
export function Note({ children }) {
  return <span className="mod-note">{children}</span>
}

// A fold for the rest of a long list: one quiet line, never a wall. The body is mounted only while
// the fold is open, so a closed fold has no geometry at all -- a collapsed <details> still reports
// rectangles for its hidden children, and those rectangles land on whatever card comes next.
export function Fold({ summary, className = 'mod-more', children }) {
  const [open, setOpen] = useState(false)
  return (
    <details className={className} open={open} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>{summary}</summary>
      {open && children}
    </details>
  )
}
