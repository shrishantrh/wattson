import { diffText, diffTone, isNum, NONE } from '../lib/cmpData.js'

// The comparison itself: two columns read off the same export, and a third that subtracts
// one from the other. Nothing in the third column is a judgement, and nothing appears there
// unless both sides were measured the same way.
//
// row: {
//   k        the measure, in words
//   hint     one clause under it, when the measure needs a basis to be read
//   a, b     numbers (formatted by fmt) or, with aText/bText, words
//   fmt      number formatter, which renders a null as a middle dot
//   aText,bText   words for a side that is not a number ("private", "utility not resolved")
//   aTag,bTag     the grid a generation figure actually describes, printed under it
//   diff     units for the third column: pts, ptsyr, x, mw, pct, places
//   good     'high' | 'low' | null: which direction is better for a flat load
//   noDiff   the two sides are not on the same basis, so no difference is printed
//   hero     the row the whole comparison is for
//   warn     this side's published history is corrected
// }

function Cell({ v, text, tag, fmt, side, warn, title }) {
  const body = text != null ? text : fmt ? fmt(v) : isNum(v) ? String(v) : NONE
  const absent = text == null && !isNum(v)
  return (
    <td className={`${side}${warn ? ' warn' : ''}${absent ? ' none' : ''}`} title={title}>
      <span className="cmp-v">{body}</span>
      {tag && <span className="cmp-tag">{tag}</span>}
    </td>
  )
}

export function CmpTable({ rows, aLabel, bLabel, caption }) {
  return (
    <table className="cmp-table">
      {caption && <caption className="cmp-cap">{caption}</caption>}
      <thead>
        <tr>
          <th scope="col">Measure</th>
          <th scope="col">{aLabel}</th>
          <th scope="col">{bLabel}</th>
          <th scope="col">left minus right</th>
        </tr>
      </thead>
      <tbody>
        {rows.filter(Boolean).map((row, i) => (
          <tr key={row.k || i} className={`${row.hero ? 'hero' : ''}${row.group ? ' group' : ''}`}>
            <th scope="row"><span className="cmp-k">{row.k}</span>{row.hint && <span className="cmp-hint">{row.hint}</span>}</th>
            <Cell v={row.a} text={row.aText} tag={row.aTag} fmt={row.fmt} side="a" warn={row.aWarn} title={row.aTitle} />
            <Cell v={row.b} text={row.bText} tag={row.bTag} fmt={row.fmt} side="b" warn={row.bWarn} title={row.bTitle} />
            <td className={`d ${diffTone(row)}`} title={row.noDiff ? row.noDiffWhy || 'The two sides are not measured on the same basis.' : undefined}>
              {row.diffText != null ? row.diffText : diffText(row)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// The two names, the one figure each side is judged on, and the megawatts behind it.
// side: { name, href, value, label, mw, tone, meta }
function Side({ s, which }) {
  return (
    <div className={`cmp-hero-side ${which}`}>
      <span className="cmp-hero-k">{which}</span>
      {s.href ? <a className="cmp-hero-n" href={s.href}>{s.name}</a> : <span className="cmp-hero-n">{s.name}</span>}
      {s.meta && <span className="cmp-hero-meta">{s.meta}</span>}
      <span className={`cmp-hero-v ${s.tone || ''}`}>{s.value}</span>
      <span className="cmp-hero-l">{s.label}</span>
      {s.mw && <span className="cmp-hero-mw">{s.mw}</span>}
    </div>
  )
}

export function CmpHero({ a, b, verdict }) {
  return (
    <div className="cmp-hero">
      <Side s={a} which="left" />
      <div className="cmp-hero-mid" aria-hidden="true"><span>vs</span></div>
      <Side s={b} which="right" />
      {verdict && <p className="cmp-hero-say">{verdict}</p>}
    </div>
  )
}

export default CmpTable
