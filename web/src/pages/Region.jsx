import coords from '../data/region_coords.json'
import { loadRegion, useAsync } from '../lib/data.js'
import { Loading, ErrorState, Provisional, Pending } from '../components/States.jsx'
import { regionTitle, pct1, pts1, ordinal } from '../lib/findings.js'

// U4 region evidence view. Shell and finding now; heatmap, fuel mix and trend charts land
// after the opening review.
export default function Region({ route }) {
  const id = route.id
  const { loading, error, data, reload } = useAsync(() => loadRegion(id), [id])
  if (loading) return <div className="page"><Loading what={id} /></div>
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} />{error.name === 'NotFound' && <p className="ink2">Regions in the current fixture: {String(error._available || '')}</p>}</div>
  const c = coords.regions[id]
  const t = regionTitle(data, c?.place || c?.label)
  const det = data.detection || {}, sit = (data.type === 'zone' ? data.parent?.siting : data.siting) || data.siting || {}
  return (
    <main className="page">
      <Provisional data={data} />
      <p className="eyebrow">{data.ba_name || data.ba} · {data.type} {data.zone ? data.zone : data.ba} · {c?.place}</p>
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub}</p>
      <div>
        {det.rank && <span className="chip accent">detector {ordinal(det.rank)} of 111</span>}
        {det.pattern && <span className="chip">{det.pattern}</span>}
        {data.cf_inherited_from_ba && <span className="chip">generation figures inherited from {data.ba}</span>}
        {(data.data_flags || []).length > 0 && <span className="chip">flagged</span>}
      </div>
      <div className="kv" style={{ marginTop: 24 }}>
        <div><div className="label">Overnight clean 2025</div><div className="val">{pct1(sit.overnight_cf_share_2025 ?? data.cf_share?.['2025']?.overnight)}</div></div>
        <div><div className="label">Change since 2019</div><div className="val">{pts1(sit.change_since_2019)}</div></div>
        <div><div className="label">Clean MW / demand</div><div className="val">{sit.overnight_clean_mw_over_demand != null ? sit.overnight_clean_mw_over_demand.toFixed(2) : '—'}</div></div>
        <div><div className="label">Slope per year</div><div className="val">{sit.ratio_slope_per_year != null ? (sit.ratio_slope_per_year > 0 ? '+' : '') + sit.ratio_slope_per_year.toFixed(3) : '—'}</div></div>
      </div>
      {(data.operators_manual || []).length > 0 && (
        <section className="section">
          <h2>Who serves the load <span className="chip" style={{ marginLeft: 8 }}>hand-mapped</span></h2>
          <ul className="list">{data.operators_manual.map((o, i) => <li key={i}><span className="txt"><b>{o.utility}</b> · {o.role}</span><span className="mono ink2">{o.parent}{o.ticker ? ` · ${o.ticker}` : ''}</span></li>)}</ul>
        </section>
      )}
      <Pending>U4 evidence charts (365×24 heatmap, night vs day trend, overnight fuel mix, detector components) follow the opening review.</Pending>
    </main>
  )
}
