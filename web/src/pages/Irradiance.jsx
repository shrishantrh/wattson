import { useMemo, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Chip, Num, Section } from '../console/widgets.jsx'
import Plot from '../charts/Plot.jsx'
import { irradianceDayNight } from '../charts/builders.js'
import { loadIrradiance, loadRegions, useAsync } from '../lib/data.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { readTokens } from '../lib/tokens.js'
import { pct, signed } from '../lib/format.js'
import { href } from '../router.js'

const VERDICT_LABEL = {
  supports: 'supports',
  does_not_separate: 'does not separate',
  contradicts: 'contradicts',
  unusable: 'unusable',
}

const CALLOUT_ID = 'ERCO/NRTH'

function ptsLabel(v) {
  return v == null ? '—' : `${signed(v, 1)} pts`
}

function sharePct(v) {
  return v == null ? '—' : pct(v, 1)
}

function KVFlat({ rows }) {
  return (
    <ul className="kvrows">
      {rows.map(([k, v]) => <li key={k}><span>{k}</span><span>{v}</span></li>)}
    </ul>
  )
}

export default function Irradiance() {
  const { loading, error, data, reload } = useAsync(async () => {
    const [irr, regs] = await Promise.all([loadIrradiance(), loadRegions()])
    return { irr, meta: regs.meta }
  }, [])
  const [focus, setFocus] = useState(CALLOUT_ID)
  const back = () => { window.location.hash = href.landing() }
  const chart = useMemo(() => (data ? irradianceDayNight(data.meta, data.irr) : null), [data])
  const regions = data?.irr?.regions || []
  const ercot = regions.find(r => r.region === CALLOUT_ID)
  const conclusion = data?.irr?.conclusion
  const nat = data?.meta?.national?.cf_share || data?.irr?.national_reference
  const n19 = nat?.['2019'], n25 = nat?.['2025']

  const globe = useMemo(() => {
    if (!regions.length) return { view: { lat: 38.5, lng: -97, altitude: 1.6 }, interactive: false }
    const tk = readTokens()
    const colorFor = v => (v === 'supports' ? tk.accent : v === 'unusable' ? tk.muted : tk.ink2)
    const pts = regions.filter(r => r.point?.lat != null).map(r => ({
      id: r.region,
      lat: r.point.lat,
      lng: r.point.lon,
      r: r.region === focus ? 0.26 : r.verdict === 'supports' ? 0.18 : 0.12,
      color: colorFor(r.verdict),
    }))
    const f = regions.find(r => r.region === focus)
    return {
      view: f?.point ? { lat: f.point.lat, lng: f.point.lon, altitude: 1.35 } : { lat: 36, lng: -98, altitude: 1.55 },
      points: pts,
      markers: regions.filter(r => r.point).map(r => ({
        id: r.region,
        lat: r.point.lat,
        lng: r.point.lon,
        label: `${r.point.place} · ${VERDICT_LABEL[r.verdict] || r.verdict}`,
        href: href.region(r.region),
        color: colorFor(r.verdict),
      })),
      rings: f?.point ? [{ id: f.region, lat: f.point.lat, lng: f.point.lon, color: tk.accent, maxR: 2.8, speed: 0.7, period: 1600 }] : [],
      interactive: true,
    }
  }, [regions, focus])

  if (loading || error) {
    return <Shell page="irradiance" globe={{ view: { lat: 36, lng: -98, altitude: 1.6 }, interactive: false }} column={<Card title={<b>Day vs night</b>} onClose={back}>{loading ? <Loading what="irradiance" /> : <ErrorState error={error} onRetry={reload} />}</Card>} />
  }

  const dayDelta = n19 && n25 ? (n25.daytime - n19.daytime) * 100 : null
  const nightDelta = n19 && n25 ? (n25.overnight - n19.overnight) * 100 : null
  const ercotRatio = ercot && Math.abs(ercot.cf_share.overnight_change_pts) > 0.05
    ? Math.abs(ercot.cf_share.daytime_change_pts / ercot.cf_share.overnight_change_pts)
    : null

  const column = (
    <>
      <Card title={<b>Why the day got clean and the night didn&apos;t</b>} onClose={back}>
        <h1 className="verdict" style={{ fontSize: 24, lineHeight: 1.2 }}>Same sun. Different grids.</h1>
        <p className="note" style={{ marginTop: 10 }}>
          NASA POWER satellite irradiance is flat at every point we checked — year-to-year variation
          {' '}{Math.min(...regions.map(r => r.irradiance.year_to_year_variation_pct)).toFixed(2)}–
          {Math.max(...regions.map(r => r.irradiance.year_to_year_variation_pct)).toFixed(2)}%.
          The daytime resource did not change. Installed solar did. Overnight never had that resource.
        </p>
        {n19 && n25 && (
          <div className="nums" style={{ marginTop: 14 }}>
            <Num num={n25.daytime} format={v => sharePct(v)} label="National daytime 2025" sub={`was ${sharePct(n19.daytime)} in 2019 · ${ptsLabel(dayDelta)}`} accent />
            <Num num={n25.overnight} format={v => sharePct(v)} label="National overnight 2025" sub={`was ${sharePct(n19.overnight)} in 2019 · ${ptsLabel(nightDelta)}`} />
            <Num value="flat" label="Satellite irradiance" sub="5 points · no trend · NASA POWER" />
          </div>
        )}
        <p className="note" style={{ marginTop: 12 }}>
          Clean separation in {(conclusion?.supporting_regions || []).length} of {regions.length} regions
          ({(conclusion?.supporting_regions || []).join(', ')}).
          Kept on screen, not dropped: {(conclusion?.non_supporting_regions || []).join(', ')}.
        </p>
      </Card>

      {chart && !chart.empty && (
        <Section title={chart.title}>
          <p className="note" style={{ marginBottom: 10 }}>{chart.note}</p>
          <Plot data={chart.data} layout={chart.layout} height={300} />
        </Section>
      )}

      {ercot && (
        <Section
          title="The clearest case · ERCOT North"
          right={<Chip small accent onClick={() => setFocus(CALLOUT_ID)}>{VERDICT_LABEL[ercot.verdict]}</Chip>}
        >
          <p className="note" style={{ marginBottom: 12 }}>
            Dallas irradiance point. Carbon-free share is ERCOT&apos;s (zone inherits the BA).
            {ercotRatio != null && <> Daytime moved ~{ercotRatio.toFixed(0)}× as far as overnight, in percentage points — same years, flat sun.</>}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <Num num={ercot.cf_share.daytime_change_pts} format={v => ptsLabel(v)} label="Daytime clean share" sub={`${sharePct(ercot.cf_share['2019'].daytime)} → ${sharePct(ercot.cf_share['2025'].daytime)}`} accent />
            <Num num={ercot.irradiance.change_pct_2019_2025} format={v => `${signed(v, 1)}%`} label="Irradiance endpoint" sub={`flatness band ${ercot.irradiance.year_to_year_variation_pct.toFixed(2)}% · different stat`} />
            <Num num={ercot.cf_share.overnight_change_pts} format={v => ptsLabel(v)} label="Overnight clean share" sub={`${sharePct(ercot.cf_share['2019'].overnight)} → ${sharePct(ercot.cf_share['2025'].overnight)}`} />
          </div>
          <KVFlat rows={[
            ['Year-to-year variation (flatness band)', `${ercot.irradiance.year_to_year_variation_pct.toFixed(2)}%`],
            ['2019→2025 irradiance endpoint change', `${signed(ercot.irradiance.change_pct_2019_2025, 2)}%`],
            ['Irradiance mean (Dallas)', `${ercot.irradiance.mean.toFixed(2)} ${ercot.irradiance.units}`],
            ['Share actually describes', ercot.cf_share_actually_describes],
          ]} />
          {ercot.scale_mismatch_note && <p className="note" style={{ marginTop: 10 }}>{ercot.scale_mismatch_note}</p>}
        </Section>
      )}

      <Section title="Five regions · including the ones that fail">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {regions.map(r => (
            <Chip key={r.region} small active={r.region === focus} accent={r.verdict === 'supports'} dim={r.verdict === 'unusable'} onClick={() => setFocus(r.region)}>
              {r.point?.place || r.region} · {VERDICT_LABEL[r.verdict]}
            </Chip>
          ))}
        </div>
        <ul className="rows">
          {regions.map(r => {
            const on = r.region === focus
            return (
              <li
                className={`row ${on ? 'lead' : ''}`}
                key={r.region}
                style={{ alignItems: 'flex-start', gap: 12, cursor: 'pointer', background: on ? 'var(--accent-soft)' : undefined, margin: '0 -8px', padding: '10px 8px', borderRadius: 8 }}
                onClick={() => setFocus(r.region)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <a href={href.region(r.region)} onClick={e => e.stopPropagation()}>{r.region}</a>
                    <span className="note">{r.name}</span>
                    <Chip small dim={r.verdict !== 'supports'} accent={r.verdict === 'supports'}>{VERDICT_LABEL[r.verdict] || r.verdict}</Chip>
                  </div>
                  <div className="d" style={{ marginTop: 4 }}>
                    Day {sharePct(r.cf_share['2019'].daytime)}→{sharePct(r.cf_share['2025'].daytime)} ({ptsLabel(r.cf_share.daytime_change_pts)})
                    {' · '}night {sharePct(r.cf_share['2019'].overnight)}→{sharePct(r.cf_share['2025'].overnight)} ({ptsLabel(r.cf_share.overnight_change_pts)})
                  </div>
                  <div className="d">
                    Irradiance: year-to-year variation {r.irradiance.year_to_year_variation_pct.toFixed(2)}%
                    {' · '}endpoint {signed(r.irradiance.change_pct_2019_2025, 2)}%
                    {' · '}mean {r.irradiance.mean.toFixed(2)} {r.irradiance.units}
                  </div>
                  {r.scale_mismatch_note && <p className="note" style={{ marginTop: 6 }}>{r.scale_mismatch_note}</p>}
                  {r.data_caveat && <p className="note" style={{ marginTop: 6 }}>{r.data_caveat}</p>}
                  {r.why_it_does_not_support?.reading && (
                    <p className="note" style={{ marginTop: 6 }}>
                      {r.why_it_does_not_support.post_hoc ? 'Post-hoc: ' : ''}{r.why_it_does_not_support.reading}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="Caveats">
        <ul className="rows">{(data.irr.caveats || []).map((c, i) => <li className="row" key={i}><div className="t" style={{ fontSize: 13 }}>{c}</div></li>)}</ul>
      </Section>
    </>
  )

  return <Shell page="irradiance" globe={globe} column={column} columnWidth={740} />
}
