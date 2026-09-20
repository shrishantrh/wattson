import { useMemo, useState } from 'react'
import { cellValue } from './Table.jsx'
import { isNum, DASH } from './WxControls.jsx'
import '../styles/wx.css'

// Click a column, see where the figure came from.
//
// A sheet of numbers with no provenance is an assertion. Every column below names the JSON
// path it is read from, the script that produced it, the unit it is stored in (shares are
// 0-1 fractions in the file and percentages only on screen), and what a missing value means.
// The spread, the count and the number of blanks are computed from the rows on screen right
// now, so the panel cannot drift from the table above it.

const PIPELINE = {
  detector: 'scripts/l3_detector.py — demand only, weights frozen before the ranking was seen',
  siting: 'scripts/l4_supply.py — the siting score (level, direction, clean power against night demand)',
  index: 'scripts/carbon_free_index.py — hourly carbon-free share per balancing authority',
  alerts: 'scripts/alerts.py — monthly thresholds, ranked by magnitude × persistence × recency',
  claims: 'claims/companies.json — claims read off the rendered pages of each company’s own reports',
  hand: 'hand-curated lookup in web/src/data — not derived from the grid data',
}
const EIA = 'EIA-930 hourly operations and net generation by energy source, via PUDL; snapshot ends 2026-09-05'

// sheet -> column key -> { path, file, by, unit, note }
const FIELDS = {
  regions: {
    place: { path: 'region_coords.json regions[id].label', file: 'web/src/data/region_coords.json', by: PIPELINE.hand, unit: 'text', note: 'The display name. The grid identifier is the next column.' },
    id: { path: 'regions[].id', file: 'api/regions.json', by: PIPELINE.index, unit: 'text', note: 'BA code, or BA/ZONE for a zone inside one. A zone reports demand only.' },
    night: { path: 'regions[].siting.overnight_cf_share_2025', file: 'api/regions.json', by: PIPELINE.index, unit: '0–1 fraction, shown as a percent', note: 'Carbon-free share of generation over 00:00–05:59 local, averaged across 2025. Carbon-free = nuclear + hydro + wind + solar + geothermal; storage excluded; other or unknown counts in the denominator only.' },
    day: { path: 'regions[].cf_share_2025.daytime', file: 'api/regions.json', by: PIPELINE.index, unit: '0–1 fraction, shown as a percent', note: 'Same measure over 10:00–15:59 local, when solar is doing the work.' },
    change: { path: 'regions[].siting.change_since_2019', file: 'api/regions.json', by: PIPELINE.siting, unit: 'fraction, shown as percentage points', note: 'Change in the night share against the 2019 baseline. A falling share is not clean generation shrinking; open a region to switch the same series to megawatts.' },
    slope: { path: 'regions[].siting.ratio_slope_per_year', file: 'api/regions.json', by: PIPELINE.siting, unit: 'fraction per year, shown as points per year', note: 'Least-squares slope over 2019–2025 of overnight clean MW divided by overnight demand. A slope only: no years-remaining, no nameplate headroom.' },
    headroom: { path: 'regions[].siting.overnight_clean_mw_over_demand', file: 'api/regions.json', by: PIPELINE.siting, unit: 'ratio', note: 'Clean megawatts generated at night divided by the demand of the same footprint at night. Above 1.00 means the grid makes more clean power overnight than it uses; imports and exports are not allocated.' },
    siting_score: { path: 'regions[].siting.siting_score', file: 'api/regions.json', by: PIPELINE.siting, unit: 'score, mean of percentile ranks', note: 'Level, direction and clean power against night demand, equally weighted. Ranked over the 52 balancing authorities with generation data.' },
    rank: { path: 'regions[].detection.rank', file: 'api/regions.json', by: PIPELINE.detector, unit: 'rank of 111', note: 'Position on the flat-load detector. 1 is the strongest round-the-clock demand growth, not the dirtiest grid.' },
    score: { path: 'regions[].detection.score', file: 'api/regions.json', by: PIPELINE.detector, unit: 'score', note: 'z(overnight excess) + z(neighbor divergence) + 0.5 z(load factor delta), robust z on median and MAD. Regions under 500 MW average demand are excluded.' },
    growth: { path: 'regions[].detection.growth_pct', file: 'api/regions.json', by: PIPELINE.detector, unit: 'percent', note: 'Average demand in 2025 against 2019. Demand, not generation.' },
    excess: { path: 'regions[].detection.overnight_excess', file: 'api/regions.json', by: PIPELINE.detector, unit: 'percentage points', note: 'Overnight demand growth minus average demand growth. A load that never switches off lifts the night faster than the average; that gap is the whole signal.' },
    pattern: { path: 'regions[].detection.pattern', file: 'api/regions.json', by: PIPELINE.detector, unit: 'label', note: 'Descriptive only and never part of the score. The rules are printed on the Method page and can be checked against these columns.' },
    flags: { path: 'regions[].data_flags / has_corrections', file: 'api/regions.json', by: PIPELINE.index, unit: 'label', note: '"flagged" means the reported numbers move in a way the data does not explain; "corrected" means the engine publishes a different figure from the published one.' },
  },
  alerts: {
    place: { path: 'region_coords.json regions[id].label', file: 'web/src/data/region_coords.json', by: PIPELINE.hand, unit: 'text', note: 'Display name for the alert’s region.' },
    rule: { path: 'alerts[].rule', file: 'api/alerts.json', by: PIPELINE.alerts, unit: 'label', note: 'Which monthly threshold this region crossed. One region can appear under more than one rule.' },
    tier: { path: 'alerts[].tier', file: 'api/alerts.json', by: PIPELINE.alerts, unit: 'label', note: 'primary is where to look first; supporting and chronic are real but smaller or older.' },
    severity: { path: 'alerts[].severity', file: 'api/alerts.json', by: PIPELINE.alerts, unit: 'score', note: 'How far past the threshold, times how many months it has held, times how recent. A slow drift never outranks a change that is big and still moving.' },
    since: { path: 'alerts[].first_crossed', file: 'api/alerts.json', by: PIPELINE.alerts, unit: 'month', note: 'The first trailing-12 month that crossed. Blank where the alert comes from demand shape rather than a monthly threshold.' },
    months: { path: 'alerts[].months_active_streak', file: 'api/alerts.json', by: PIPELINE.alerts, unit: 'months', note: 'Consecutive months over the line, without a break.' },
    value: { path: 'alerts[].current_value', file: 'api/alerts.json', by: PIPELINE.alerts, unit: 'MW, a 0–1 share, or a rank — see the row’s rule', note: 'The trailing-12 figure for the latest month. Compare it with the 2019 column beside it, and read MW rows as output and share rows as a slice.' },
    base: { path: 'alerts[].baseline_2019', file: 'api/alerts.json', by: PIPELINE.alerts, unit: 'same unit as the row', note: 'The 2019 baseline the threshold is measured against.' },
  },
  companies: {
    talk_score: { path: 'companies[].talk_score', file: 'api/companies.json', by: PIPELINE.claims, unit: '0–1 fraction, shown as a percent', note: 'What the company claims. Null where no claim has been extracted yet, and a null is an em dash, never a zero.' },
    walk_score: { path: 'companies[].walk_score', file: 'api/companies.json', by: PIPELINE.claims, unit: '0–1 fraction, shown as a percent', note: 'The average clean share of the grids under its mapped sites. Grid-only and all-hours: contracted clean power is excluded by design, so this is not a score of the company.' },
    coverage: { path: 'companies[].coverage', file: 'api/companies.json', by: PIPELINE.claims, unit: '0–1 fraction', note: 'How much of the company’s site list we could map to a grid.' },
    cannot_verify_count: { path: 'companies[].cannot_verify_count', file: 'api/companies.json', by: PIPELINE.claims, unit: 'count', note: 'Claims that grid data cannot settle either way. Counted on screen rather than dropped.' },
  },
  claims: {
    verbatim: { path: 'company.claims[].verbatim', file: 'api/company/<TICKER>.json', by: PIPELINE.claims, unit: 'text', note: 'The sentence as printed in the company’s own report, with the document and page beside it.' },
    verdict: { path: 'company.claims[].verdict', file: 'api/company/<TICKER>.json', by: PIPELINE.claims, unit: 'label', note: 'true_on_paper, contradicted, unfalsifiable or cannot_verify. "True on paper" is not an accusation: an annual claim can be true under the accounting rules while the grid under the site burns gas at 3am.' },
    falsifiability: { path: 'company.claims[].falsifiability', file: 'api/company/<TICKER>.json', by: PIPELINE.claims, unit: '0–1 score', note: 'How checkable the claim is as written. A vague claim scores low and is reported as unfalsifiable rather than judged.' },
    physical_min: { path: 'company.claims[].physical_min', file: 'api/company/<TICKER>.json', by: PIPELINE.index, unit: '0–1 fraction, shown as a percent', note: 'The lowest clean share among the grids under the company’s mapped sites, from the same hourly index as the regions sheet.' },
    physical_max: { path: 'company.claims[].physical_max', file: 'api/company/<TICKER>.json', by: PIPELINE.index, unit: '0–1 fraction, shown as a percent', note: 'The highest of the same set.' },
  },
  facilities: {
    serving_utility: { path: 'facilities[].serving_utility', file: 'api/facilities.json', by: PIPELINE.hand, unit: 'text', note: 'Hand-mapped from the site outward. A human should check it before anyone judges the operator.' },
    ticker_utility: { path: 'facilities[].utility_ticker', file: 'api/facilities.json', by: PIPELINE.hand, unit: 'ticker or none', note: 'Hand-mapped and unverified, TXNM and FTS especially. "none" means the utility has no listed equity, not that we failed to find one.' },
    region_id: { path: 'facilities[].region_id', file: 'api/facilities.json', by: PIPELINE.hand, unit: 'text', note: 'Which balancing authority or zone the site sits in. This is the join that lets a claim be checked against the grid.' },
    cf_share_2025: { path: 'facilities[].cf_share_2025', file: 'api/facilities.json', by: PIPELINE.index, unit: '0–1 fraction, shown as a percent', note: 'The clean share of the grid under the site, all hours of 2025.' },
    detector_rank: { path: 'facilities[].detector_rank', file: 'api/facilities.json', by: PIPELINE.detector, unit: 'rank of 111', note: 'Where that grid sits on the flat-load detector.' },
  },
}

const fmtStat = (col, v) => {
  if (v == null) return DASH
  if (col.format) { try { return String(col.format(v, {})) } catch { /* formatter wants a row */ } }
  return isNum(v) ? String(Number(v.toPrecision(6))) : String(v)
}

export default function WxProvenance({ sheet, columns = [], rows = [], snapshot }) {
  const map = FIELDS[sheet] || {}
  const known = useMemo(() => columns.filter(c => map[c.key]), [columns, map])
  const [key, setKey] = useState(null)
  const sel = key && map[key] ? key : null
  const col = sel ? columns.find(c => c.key === sel) : null
  const field = sel ? map[sel] : null

  const stats = useMemo(() => {
    if (!col) return null
    const vals = rows.map(r => cellValue(col, r))
    const nums = vals.filter(isNum)
    const blanks = vals.filter(v => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v))).length
    const sortedNums = [...nums].sort((a, b) => a - b)
    return {
      n: vals.length,
      blanks,
      min: sortedNums.length ? sortedNums[0] : null,
      max: sortedNums.length ? sortedNums[sortedNums.length - 1] : null,
      median: sortedNums.length ? sortedNums[Math.floor((sortedNums.length - 1) / 2)] : null,
      distinct: nums.length ? null : new Set(vals.filter(v => v != null && v !== '')).size,
    }
  }, [col, rows])

  if (!known.length) return null

  return (
    <div>
      <div className="wx-group" style={{ marginTop: 4 }}>
        <span className="wx-k">where a figure comes from<b>{sel ? (col?.label || sel) : 'pick a column'}</b></span>
        <span className="wx-row">
          {known.map(c => (
            <button key={c.key} type="button" className={`chip sm ${c.key === sel ? 'on' : 'dim'}`} aria-pressed={c.key === sel} onClick={() => setKey(c.key === sel ? null : c.key)}>{c.label || c.key}</button>
          ))}
        </span>
      </div>
      {field && (
        <div className="wx-prov">
          <div className="path">{field.file} &rarr; {field.path}</div>
          <dl>
            <dt>Produced by</dt><dd>{field.by}</dd>
            <dt>From</dt><dd>{EIA}</dd>
            <dt>Stored as</dt><dd>{field.unit}</dd>
            <dt>What it is</dt><dd>{field.note}</dd>
            <dt>On screen now</dt>
            <dd>
              {stats.n} row{stats.n === 1 ? '' : 's'}
              {stats.min != null ? <>, ranging <span className="mono">{fmtStat(col, stats.min)}</span> to <span className="mono">{fmtStat(col, stats.max)}</span>, median <span className="mono">{fmtStat(col, stats.median)}</span></> : stats.distinct != null ? <>, {stats.distinct} distinct value{stats.distinct === 1 ? '' : 's'}</> : null}
              {stats.blanks > 0 ? <>. {stats.blanks} {stats.blanks === 1 ? 'row has' : 'rows have'} no value and print an em dash: absent, not zero.</> : '. No blanks.'}
            </dd>
          </dl>
        </div>
      )}
      {snapshot && <p className="note" style={{ marginTop: 10 }}>{snapshot}</p>}
    </div>
  )
}
