import { useEffect, useSyncExternalStore } from 'react'
import '../styles/states.css'

// Loading, error, offline, empty and provisional-data states. Every page uses these, so killing
// the data source shows a sentence, never a blank screen. Classes are .st-* in styles/states.css;
// .btn / .banner / .state come from base.css.

// Is the browser online? Re-renders on the window's online/offline events.
const subscribeOnline = f => { window.addEventListener('online', f); window.addEventListener('offline', f); return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f) } }
const readOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
const useOnline = () => useSyncExternalStore(subscribeOnline, readOnline, () => true)

// Three solid grey blocks shaped like the card they stand in for: the sentence, the number row,
// a caption. No animation (motion only after a user action). Screen readers get "Loading <what>".
export function Loading({ what = 'data' }) {
  return (
    <div className="st-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="st-sr">Loading {what}</span>
      <div className="st-line st-sentence" aria-hidden="true" />
      <div className="st-nums" aria-hidden="true"><i className="st-line" /><i className="st-line" /><i className="st-line" /></div>
      <div className="st-line st-caption" aria-hidden="true" />
    </div>
  )
}

// A raw fetch error reads like a stack trace; say what happened in words. The original message
// stays on the element's title for anyone who needs it.
const plain = error => {
  const raw = String(error?.message || error || 'unknown error')
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) return 'the data could not be fetched'
  if (/HTTP (\d{3})/.test(raw)) return `the server answered ${raw.match(/HTTP (\d{3})/)[1]}`
  if (/JSON|Unexpected token/i.test(raw)) return 'the data file is malformed'
  return raw
}

function Actions({ onRetry }) {
  return (
    <div className="st-actions">
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Retry</button>}
      <a className="btn" href="#/">Back to start</a>
    </div>
  )
}

// One line, then Retry and a way home. Offline browsers get the Offline variant automatically.
export function ErrorState({ error, onRetry }) {
  const online = useOnline()
  if (!online) return <Offline onRetry={onRetry} />
  const raw = String(error?.message || error || 'unknown error')
  return (
    <div className="state error st-error" role="alert">
      <p className="st-msg" title={raw}>Could not load: {plain(error)}.</p>
      <Actions onRetry={onRetry} />
    </div>
  )
}

// The browser says it is offline. Retries by itself the moment the connection comes back.
export function Offline({ onRetry }) {
  useEffect(() => {
    if (!onRetry) return
    const f = () => onRetry()
    window.addEventListener('online', f)
    return () => window.removeEventListener('online', f)
  }, [onRetry])
  return (
    <div className="state error st-error st-offline" role="alert">
      <p className="st-msg">You are offline. The data could not be loaded; it will retry when the connection returns.</p>
      <Actions onRetry={onRetry} />
    </div>
  )
}

export function Empty({ children }) { return <div className="state st-empty">{children}</div> }

export function Provisional({ data }) {
  if (!data?._provisional) return null
  return <div className="banner banner-provisional">Provisional fixture · reshaped from regions.json and the mock company file · replaced by the engine's output</div>
}

export function Pending({ children }) { return <p className="pending st-pending">{children}</p> }
