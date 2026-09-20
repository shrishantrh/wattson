import { Fragment, useCallback, useMemo, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Num, Ticks } from '../console/widgets.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import { WxRange, WxSeg, WxChips, WxReadout, useEscape, useKeyList, isNum, DASH } from '../components/WxControls.jsx'
import coords from '../data/region_coords.json'
import { loadAlerts, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { n0, pct1 } from '../lib/findings.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href, useHash } from '../router.js'
import '../styles/pages.css'
import '../styles/wx.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'

const SHORT = { demand_up_20pct: 'pulling 20%+ more power at night than in 2019', demand_record_high: 'its busiest nights on record', cf_share_down_3pts: 'clean covers less of the night than in 2019', gas_share_up_3pts_yoy: 'gas took a bigger slice of the night this year', clean_mw_below_2019: 'fewer megawatts of clean power at night than in 2019', detector_top10: 'demand shape consistent with new 24/7 load' }
const RULE_TAG = { demand_up_20pct: 'demand +20%', demand_record_high: 'record high', cf_share_down_3pts: 'share down', gas_share_up_3pts_yoy: 'gas up', clean_mw_below_2019: 'clean MW down', detector_top10: 'flat-load top ten' }
const month = m => (m ? new Date(`${m}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : DASH)
const SORTS = [['severity', 'severity'], ['streak', 'longest run'], ['recent', 'newest']]

// What changed this month: the engine's ranked alerts. Severity is magnitude x persistence x
// recency. A monthly monitor is only useful if the reader can set their own bar, so the cut is
// theirs: no row is hidden by us, every control says how many rows it removed.
export default function Alerts() {
  const { loading, error, data, reload } = useAsync(loadAlerts, [])
  const tk = useMemo(readTokens, [])
  const all = useMemo(() => (data?.alerts || []).map(a => ({ ...a, c: coords.regions[a.region], label: coords.regions[a.region]?.label || a.name || a.region })).sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0)), [data])
  const maxSev = Math.max(...all.map(r => r.severity ?? 0), 0.0001)
  const sevTop = Math.ceil(maxSev * 100) / 100

  const [minSev, setMinSev] = useState(0)
  const [rules, setRules] = useState([])
  const [tiers, setTiers] = useState([])
  const [order, setOrder] = useState('severity')
  const reset = useCallback(() => { setMinSev(0); setRules([]); setTiers([]); setOrder('severity') }, [])
  const touched = minSev > 0 || rules.length > 0 || tiers.length > 0 || order !== 'severity'
  useEscape(reset, touched)

  const rows = useMemo(() => {
    const kept = all.filter(r => (r.severity ?? 0) >= minSev && (!rules.length || rules.includes(r.rule)) && (!tiers.length || tiers.includes(r.tier)))
    const key = { severity: r => -(r.severity ?? 0), streak: r => -(r.months_active_streak ?? 0), recent: r => (r.first_crossed ? -Number(r.first_crossed.replace('-', '')) : 1) }[order]
    return [...kept].sort((a, b) => key(a) - key(b))
  }, [all, minSev, rules, tiers, order])

  const globe = useMemo(() => ({ view: { lat: 38.5, lng: -97, altitude: 1.5 }, interactive: true,
    points: rows.filter(r => r.c).map(r => ({ id: r.region, lat: r.c.lat, lng: r.c.lng, r: 0.14 + 0.2 * ((r.severity ?? 0) / maxSev), color: tk.accent })),
    markers: rows.filter(r => r.c).slice(0, 8).map((r, i) => ({ id: r.region, lat: r.c.lat, lng: r.c.lng, label: `${i + 1}  ${r.label}`, tip: SHORT[r.rule] || r.rule, href: href.region(r.region), color: i === 0 ? tk.accent : tk.ink2, lead: i === 0 })) }), [rows, maxSev, tk])
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  const nav = useKeyList(rows.length, { onOpen: i => { if (rows[i]) window.location.assign(href.region(rows[i].region)) }, onEscape: reset })

  const streaks = rows.map(r => r.months_active_streak).filter(isNum)
  const byRule = all.reduce((m, r) => ({ ...m, [r.rule]: (m[r.rule] || 0) + 1 }), {})
  const byTier = all.reduce((m, r) => ({ ...m, [r.tier || 'untiered']: (m[r.tier || 'untiered'] || 0) + 1 }), {})
  const top = Object.entries(byRule).sort((a, b) => b[1] - a[1])[0]
  const primary = all.filter(r => r.tier === 'primary')
  const regionsHit = new Set(all.map(r => r.region)).size
  const sentence = all.length
    ? `${regionsHit} ${regionsHit === 1 ? 'place is' : 'places are'} drawing more power or burning more of it in the hours the grid never cleaned up${primary.length && all.length > primary.length ? `, ${primary.length} of them hard enough to look at first` : ''}. Through ${month(data?.latest_month)}: ${all[0].label} leads, and ${top[1]} of ${all.length} signals are here for the same reason, ${SHORT[top[0]] || top[0]}.`
    : 'Nothing crossed a threshold this month.'

  let column
  const crumb = <Breadcrumbs trail={crumbs} onBack={back} />
  if (loading) column = <>{crumb}<Card title={<b>What changed</b>} onClose={back}><Loading what="alerts" /></Card></>
  else if (error) column = <>{crumb}<Card title={<b>What changed</b>} onClose={back}><ErrorState error={error} onRetry={reload} /></Card></>
  else column = (
    <>
      {crumb}
      <Card title={<><b>What changed this month</b> · trailing 12 months to {month(data.latest_month)}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
        <h1 className="verdict">{sentence}</h1>
        <div className="nums">
          <Num value={String(all.length)} label="signals across every region we score" sub={data.count_before_ranking && data.count_before_ranking !== all.length ? `ranked down from ${data.count_before_ranking}` : null} />
          <Num value={String(all.filter(r => r.rule === 'detector_top10').length)} label="are the demand shape of a load that never switches off" accent />
          <Num value={String(all.filter(r => /cf_share_down|clean_mw_below|gas_share/.test(r.rule)).length)} label="are the grid getting dirtier after dark, not just busier" />
        </div>
        <div className="wx-bar">
          <WxRange label="severity, at least" value={minSev} min={0} max={sevTop} step={0.01} onChange={setMinSev} format={v => v.toFixed(2)} />
          <WxSeg label="order by" value={order} onChange={setOrder} options={SORTS} />
        </div>
        <div className="wx-bar">
          <WxChips label="why it fired" value={rules} onChange={setRules} options={Object.entries(byRule).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, RULE_TAG[k] || k, n])} />
        </div>
        <div className="wx-bar">
          <WxChips label="tier" value={tiers} onChange={setTiers} options={Object.entries(byTier).map(([k, n]) => [k, k, n])} />
          <span className="wx-spacer" />
          <button type="button" className="btn" onClick={reset} disabled={!touched}>Reset</button>
        </div>
        <WxReadout items={[
          { value: String(rows.length), label: `of ${all.length} signals pass your cut`, tone: rows.length ? '' : 'warn' },
          { value: rows.length ? (rows[0].severity ?? 0).toFixed(2) : DASH, label: rows.length ? `worst of them: ${rows[0].label}` : 'nothing passes', tone: 'fossil' },
          { value: String(new Set(rows.map(r => r.region)).size), label: 'distinct regions in view' },
          // A detector alert comes from demand shape, not a monthly threshold, so it has no
          // streak at all. That is an absent figure, not a run of zero months.
          { value: streaks.length ? String(Math.max(...streaks)) : DASH, label: streaks.length ? 'longest run of months over the line' : 'none of these come from a monthly threshold' },
        ]} />
        <p className="note" style={{ marginTop: 12 }}>Severity is how far past the threshold, times how many months it has held, times how recent, so a slow drift that has run for years never outranks something big and still moving. Most of the volume in a monitor like this is real but old; rather than pick a cut for you, raise the severity bar or drop a rule until what is left is what you would actually call someone about. {data.excluded_regions?.length ? `${data.excluded_regions.join(', ')} raise no alerts at all: their reported numbers move in a way the data does not explain, and we would rather say so than publish a signal we cannot stand behind.` : 'Regions whose reported numbers move in a way the data does not explain raise no alerts at all.'}</p>
      </Card>
      <Card>
        {rows.length === 0 ? (
          <p className="wx-none">Nothing clears <b>severity {minSev.toFixed(2)}</b>{rules.length ? <> under the {rules.length === 1 ? 'rule' : 'rules'} you kept</> : null}. The highest severity in the whole set is <b>{maxSev.toFixed(2)}</b>. Lower the bar, or press Reset.</p>
        ) : (
          <>
            <div {...nav.listProps} className="rows al-rows wx-list" role="list" aria-label="Alerts">
              {rows.map((r, i) => (
                <Fragment key={r.region + r.rule}>
                  {i > 0 && rows[i - 1].tier === 'primary' && r.tier !== 'primary' && order === 'severity' && <div className="al-tier">supporting and chronic</div>}
                  <a data-wx-item className={`row${r.tier && r.tier !== 'primary' ? ' supporting' : ''}${i === nav.index ? ' lead' : ''}`} href={href.region(r.region)} aria-current={i === nav.index ? 'true' : undefined}>
                    <span className="rk">{i + 1}</span>
                    <div>
                      <div className="t">{r.label} <span className="muted">· {SHORT[r.rule] || r.rule}</span>{r.tier && r.tier !== 'primary' && <span className="chip sm al-chip">{r.tier}</span>}</div>
                      <div className="d">{r.first_crossed ? `over the line since ${month(r.first_crossed)}` : 'flagged by demand shape, not a monthly threshold'}{r.months_active_streak ? ` · ${r.months_active_streak} months without a break` : ''}{r.unit === 'MW' && r.current_value != null ? (r.rule === 'clean_mw_below_2019' ? ` · ${n0(r.current_value)} MW of clean power overnight, was ${n0(r.baseline_2019)} MW in 2019` : ` · drawing ${n0(r.current_value)} MW through the night, was ${n0(r.baseline_2019)} MW in 2019`) : r.unit === 'share' && r.current_value != null ? ` · clean covers ${pct1(r.current_value)} of the night, was ${pct1(r.baseline_2019)} in 2019 — a share, not output` : r.unit === 'rank' && r.current_value != null ? ` · #${n0(r.current_value)} of every region scored${r.growth_pct != null ? `, demand up ${r.growth_pct}% since 2019` : ''}` : isNum(r.score) ? ` · score ${r.score.toFixed(1)}` : ''}</div>
                    </div>
                    <Ticks value={(r.severity ?? 0) / maxSev * 100} max={100} n={12} accent={i === 0} />
                    <span className="n">{isNum(r.severity) ? r.severity.toFixed(2) : DASH}</span>
                  </a>
                </Fragment>
              ))}
            </div>
            <p className="wx-hint" style={{ marginTop: 10 }}>Click the list, then <span className="wx-kbd">&uarr;</span> <span className="wx-kbd">&darr;</span> to walk it and <span className="wx-kbd">&crarr;</span> to open the region. <span className="wx-kbd">Esc</span> clears the cut.</p>
          </>
        )}
      </Card>
    </>
  )
  return <Shell page="alerts" globe={globe} column={column} columnWidth={520} />
}
