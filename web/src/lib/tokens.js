// Reads the CSS design tokens at call time so charts and the globe follow a token swap.
const FALLBACK = { bg: '#0a0a0b', surface: '#131316', ink: '#ececea', ink2: '#a6a6a2', muted: '#6f6f6b', line: '#26262a', accent: '#f2b34c' }
export function readTokens() {
  if (typeof document === 'undefined') return FALLBACK
  const cs = getComputedStyle(document.documentElement)
  const g = (k, f) => (cs.getPropertyValue(k) || '').trim() || f
  return { bg: g('--bg', FALLBACK.bg), surface: g('--surface', FALLBACK.surface), ink: g('--ink', FALLBACK.ink), ink2: g('--ink-2', FALLBACK.ink2), muted: g('--muted', FALLBACK.muted), line: g('--line', FALLBACK.line), accent: g('--accent', FALLBACK.accent) }
}
