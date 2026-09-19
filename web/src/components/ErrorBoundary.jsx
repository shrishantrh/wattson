import { Component } from 'react'

// A thrown render error shows a real message, never a white screen.
export default class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('render error', err, info?.componentStack) }
  render() {
    if (!this.state.err) return this.props.children
    const msg = String(this.state.err?.message || this.state.err)
    return (
      <div className="page">
        <div className="banner banner-error">Something failed to render: {msg}</div>
        <button className="btn" onClick={() => this.setState({ err: null })}>Try again</button>
        <a className="btn" style={{ marginLeft: 8 }} href="#/">Back to the opening</a>
      </div>
    )
  }
}
