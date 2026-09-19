export default function About({ meta }) {
  return (
    <>
      <section className="hero"><h1>Method and caveats</h1><p>Generated {meta.generated} from the PUDL snapshot ending {meta.data_snapshot_end}. Baseline year {meta.baseline_year}.</p></section>
      <section className="card"><h3>Definitions</h3>
        <ul className="plain"><li>Carbon-free = nuclear + hydro + wind + solar + geothermal. Fossil = gas + coal + oil. Other/unknown counts in the denominator, not as carbon-free. Storage excluded. Value column: EIA-adjusted net generation.</li>
          <li>Overnight = {meta.overnight_hours_local} local time; daytime = {meta.daytime_hours_local}. Each BA's reporting time zone from EIA.</li>
          <li>Trailing-12-month series drop partial months; 2026 comparisons also use the same-months (Jan–Aug) basis.</li></ul></section>
      <section className="card"><h3>Detector</h3><p>{meta.detector.method}. {meta.detector.n_scored} regions scored. Validation regions named in advance: {meta.detector.validation_named_in_advance.join(', ')}. Dallas (ERCO/NCEN) does not fire: it grew 14% but the median ERCOT zone grew about 26%, so its neighbor divergence is negative. The method penalizes zones inside a BA that is booming overall; reported as is.</p>
        <dl className="kv">{Object.entries(meta.pattern_labels).map(([k, v]) => <><dt key={k + 'k'}>{k}</dt><dd key={k + 'v'}>{v}</dd></>)}</dl></section>
      <section className="card"><h3>Caveats we hold to</h3><ul className="plain">{meta.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul></section>
      <section className="card"><h3>Data flags</h3><dl className="kv">{Object.entries(meta.data_flags).map(([k, v]) => <><dt key={k + 'k'}>{k}</dt><dd key={k + 'v'}>{v}</dd></>)}</dl></section>
    </>
  )
}
