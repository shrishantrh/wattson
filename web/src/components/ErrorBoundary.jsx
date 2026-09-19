import { Component } from 'react'
import '../styles/states.css'

// A thrown render error shows a real message, never a white screen: what failed, where (one
// mono line), and four ways out: try again, reload, copy the error, go home. Each error object
// is logged once, whatever React does with the tree afterwards.
const logged = new WeakSet()

// First useful frame: the thrown error's own stack if it has one, else the component stack.
const frameOf = (err, componentStack) => {
  const own = String(err?.stack || '').split('\n').map(s => s.trim()).find(s => /^at\s/.test(s) || /@/.test(s))
  const comp = String(componentStack || '').split('\n').map(s => s.trim()).find(Boolean)
  return (own || comp || '').replace(/^at\s+/, '').replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:)]*/, '')
}

export default class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null, componentStack: '', copied: false } }
  static getDerivedStateFromError(err) { return { err, copied: false } }
  componentDidCatch(err, info) {
    this.setState({ componentStack: info?.componentStack || '' })
    if (err && typeof err === 'object') { if (logged.has(err)) return; logged.add(err) }
    console.error('render error', err, info?.componentStack)
  }
  copy = () => {
    const { err, componentStack } = this.state
    const text = [`${err?.name || 'Error'}: ${err?.message || err}`, err?.stack || '', componentStack ? `Component stack:${componentStack}` : '', window.location.href].filter(Boolean).join('\n')
    const done = () => { this.setState({ copied: true }); setTimeout(() => this.setState({ copied: false }), 1500) }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => {})
  }
  render() {
    if (!this.state.err) return this.props.children
    const { err, componentStack, copied } = this.state
    const msg = String(err?.message || err)
    const frame = frameOf(err, componentStack)
    return (
      <div className="card st-boundary" role="alert">
        <div className="banner banner-error">Something failed to render: {msg}</div>
        {frame && <code className="st-stack" title={frame}>{frame}</code>}
        <div className="st-actions">
          <button type="button" className="btn" onClick={() => this.setState({ err: null, componentStack: '' })}>Try again</button>
          <button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button>
          <button type="button" className="btn" onClick={this.copy} disabled={!navigator.clipboard}>{copied ? 'Copied' : 'Copy error'}</button>
          <a className="btn" href="#/">Back to start</a>
        </div>
      </div>
    )
  }
}
