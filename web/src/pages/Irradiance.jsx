import { useMemo, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Chip, Num, Section } from '../console/widgets.jsx'
import Plot from '../charts/Plot.jsx'
import { irradianceDayNight } from '../charts/builders.js'
import { loadIrradiance, loadRegion, loadRegions, useAsync } from '../lib/data.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { readTokens } from '../lib/tokens.js'
import { gw, pct, signed } from '../lib/format.js'
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


/** The hour-by-hour payoff of a flat load in one region.
 *
 *  Irradiance tells you the sun did not change. profile_24h tells you what that meant:
 *  the hours the sun covers got cleaner and the hours it does not did not. A 24/7 load
 *  runs through both, so the gap between them is what it actually costs to site here.
 */
function HourPayoff({ profile, mw = 300 }) {
  const p = profile?.['2025']
  if (!Array.isArray(p) || p.length !== 24) return null
  const sun = p.slice(10, 16), dark = [...p.slice(0, 6)]
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length
  const sunAvg = avg(sun), darkAvg = avg(dark), allAvg = avg(p)
  const max = Math.max(...p)
  const fossilNight = Math.round(mw * (1 - darkAvg))
  const fossilSun = Math.round(mw * (1 - sunAvg))
  return (
    <div className="hp">
      <div className="hp-bars" role="img" aria-label="clean share by hour of day">
        {p.map((v, h) => {
          const band = h >= 10 && h < 16 ? 'sun' : h < 6 ? 'dark' : 'mid'
          return <div key={h} className={`hp-bar hp-${band}`} style={{ height: `${Math.round((v / max) * 100)}%` }}
                      title={`${String(h).padStart(2, '0')}:00 — ${Math.round(v * 100)}% clean`} />
        })}
      </div>
      <div className="hp-axis"><span>midnight</span><span>6am</span><span>noon</span><span>6pm</span></div>
      <p className="hp-read">
        A <b>{mw} MW</b> load running here draws <b className="fossil">{fossilNight} MW</b> from
        fossil generation between midnight and 6am, and <b className="clean">{fossilSun} MW</b> between
        10am and 4pm. Same machine, same power, <b>{Math.round((fossilNight - fossilSun))} MW</b> of
        difference — decided entirely by the hour.
      </p>
      <p className="hp-note">
        Sun hours run {Math.round(sunAvg * 100)}% clean, dark hours {Math.round(darkAvg * 100)}%,
        and the whole day averages {Math.round(allAvg * 100)}%. Satellite irradiance at this point
        did not change over the period; what changed is how much was built to catch it.
      </p>
    </div>
  )
}

export default function Irradiance() {
  const { loading, error, data, reload } = useAsync(async () => {
    const [irr, regs] = await Promise.all([loadIrradiance(), loadRegions()])
    const ids = (irr.regions || []).map(r => r.region)
    const details = await Promise.all(ids.map(id => loadRegion(id).catch(() => null)))
    const profiles = {}
    ids.forEach((id, i) => { if (details[i]?.profile_24h) profiles[id] = details[i].profile_24h })
    return { irr, meta: regs.meta, profiles }
  }, [])
  const [focus, setFocus] = useState(CALLOUT_ID)
  const back = () => { window.location.hash = href.landing() }
  const chart = useMemo(() => (data ? irradianceDayNight(data.meta, data.irr) : null), [data])
  const regions = data?.irr?.regions || []
  const ercot = regions.find(r => r.region === CALLOUT_ID)
  const conclusion = data?.irr?.conclusion
  const nat = data?.meta?.national?.cf_share || data?.irr?.national_reference
  const natMw = data?.meta?.national?.cf_avg_mw
  const n19 = nat?.['2019'], n25 = nat?.['2025']
  const mw19 = natMw?.['2019'], mw25 = natMw?.['2025']

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
        <h1 className="verdict" style={{ fontSize: 24, lineHeight: 1.2 }}>The sun never changed. We built panels. Panels don&apos;t work at night.</h1>
        <p className="note" style={{ marginTop: 10 }}>
          Sunlight is the control variable here, and it did not move: satellite irradiance varies only
          {' '}{Math.min(...regions.map(r => r.irradiance.year_to_year_variation_pct)).toFixed(2)}–
          {Math.max(...regions.map(r => r.irradiance.year_to_year_variation_pct)).toFixed(2)}% a year at all five points.
          So the daytime gain below is panels we built, not a sunnier decade — and panels make nothing at 3am,
          which is the hour a datacenter pulls exactly as hard as at noon.
        </p>
        {n19 && n25 && (
          <div className="nums" style={{ marginTop: 14 }}>
            <Num num={n25.daytime} format={v => sharePct(v)} label="Clean 10am–4pm — the window that improved" sub={`up from ${sharePct(n19.daytime)} in 2019 · ${ptsLabel(dayDelta)}`} accent />
            <Num num={n25.overnight} format={v => sharePct(v)} label="Clean midnight–6am — the window that did not" sub={`down from ${sharePct(n19.overnight)} in 2019 · ${ptsLabel(nightDelta)}${mw19 && mw25 ? ` · clean output still rose ${gw(mw19.overnight)}→${gw(mw25.overnight)}; the rest of the night grew faster` : ''}`} />
            <Num value="flat" label="The sun, 2019 to 2025" sub="unchanged at all 5 points — so it explains none of the daytime gain" />
          </div>
        )}
        <p className="note" style={{ marginTop: 12 }}>
          Day and night pull apart in {(conclusion?.supporting_regions || []).length} of {regions.length} regions
          ({(conclusion?.supporting_regions || []).join(', ')}). In the other {(conclusion?.non_supporting_regions || []).length} they move together —
          wind grids and one broken feed — and we left them on screen rather than dropping them:
          {' '}{(conclusion?.non_supporting_regions || []).join(', ')}.
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
          title={`What the flat sun cost · ${(regions.find(r => r.region === focus) || ercot).name || focus}`}
          right={<Chip small accent onClick={() => setFocus(CALLOUT_ID)}>{VERDICT_LABEL[ercot.verdict]}</Chip>}
        >
          <p className="note" style={{ marginBottom: 12 }}>
            {ercotRatio != null && <>The cleanest split in the data: ERCOT&apos;s daytime clean share moved ~{ercotRatio.toFixed(0)}× as far as its overnight share over the same years, under sun that did not change — consistent with solar, which only works in daylight. </>}
            The share is all of ERCOT; the irradiance point is Dallas.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <Num num={ercot.cf_share.daytime_change_pts} format={v => ptsLabel(v)} label="Day: solar showed up" sub={`${sharePct(ercot.cf_share['2019'].daytime)} → ${sharePct(ercot.cf_share['2025'].daytime)}`} accent />
            <Num num={ercot.irradiance.change_pct_2019_2025} format={v => `${signed(v, 1)}%`} label="Sun: no trend" sub={`no bigger than its ordinary ${ercot.irradiance.year_to_year_variation_pct.toFixed(2)}% yearly wobble`} />
            <Num num={ercot.cf_share.overnight_change_pts} format={v => ptsLabel(v)} label="Night: barely moved" sub={`${sharePct(ercot.cf_share['2019'].overnight)} → ${sharePct(ercot.cf_share['2025'].overnight)}`} />
          </div>
          <HourPayoff profile={data.profiles?.[focus]} />
          <KVFlat rows={[
            ['Sun over Dallas, every year since 2019', `${ercot.irradiance.mean.toFixed(2)} ${ercot.irradiance.units}, moving ${ercot.irradiance.year_to_year_variation_pct.toFixed(2)}% a year`],
            ['The share above is', `all of ${ercot.cf_share_actually_describes} — the zone reports demand only, so it inherits its grid's mix`],
          ]} />
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
                    Sun here: {r.irradiance.is_flat ? 'flat' : 'moving'} — ±{r.irradiance.year_to_year_variation_pct.toFixed(2)}% a year, {signed(r.irradiance.change_pct_2019_2025, 2)}% end to end
                  </div>
                  {r.cf_inherited_from_ba && <p className="note" style={{ marginTop: 6 }}>Share is all of {r.cf_share_actually_describes}, not just {r.point?.place} — the zone reports demand only.</p>}
                  {r.data_caveat && <p className="note" style={{ marginTop: 6 }}><b>Not a real collapse — a reporting break.</b> {r.data_caveat}</p>}
                  {r.why_it_does_not_support?.reading && (
                    <p className="note" style={{ marginTop: 6 }}>
                      {r.why_it_does_not_support.post_hoc ? 'Why it misses, worked out after we saw it: ' : 'Why it misses: '}{r.why_it_does_not_support.reading}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="What this page cannot tell you">
        <details>
          <summary className="note" style={{ cursor: 'pointer' }}>{(data.irr.caveats || []).length} limits — chiefly that one hand-picked point is not a grid. Open them.</summary>
          <ul className="rows" style={{ marginTop: 8 }}>{(data.irr.caveats || []).map((c, i) => <li className="row" key={i}><div className="t" style={{ fontSize: 13 }}>{c}</div></li>)}</ul>
        </details>
      </Section>
    </>
  )

  return <Shell page="irradiance" globe={globe} column={column} columnWidth={740} />
}
