// Loading, error, empty and provisional-data states. Every page uses these, so killing the
// data source shows a sentence, not a blank screen.
export function Loading({ what = 'data' }) { return <div className="state">Loading {what}…</div> }

export function ErrorState({ error, onRetry }) {
  const msg = String(error?.message || error || 'unknown error')
  return <div className="state error">Could not load: {msg}{onRetry && <button className="btn" onClick={onRetry}>Retry</button>}</div>
}

export function Empty({ children }) { return <div className="state">{children}</div> }

export function Provisional({ data }) {
  if (!data?._provisional) return null
  return <div className="banner banner-provisional">Provisional fixture · reshaped from regions.json and the mock company file · replaced by the engine's output</div>
}

export function Pending({ children }) { return <p className="pending">{children}</p> }
