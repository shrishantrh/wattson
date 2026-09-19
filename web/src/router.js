import { useEffect, useState } from 'react'

// #/ landing · #/screen?by=preset · #/check/META · #/compare?mw=300&metros=a|b|c · #/found?s=scene · #/region/<id> · #/method
export function parseHash(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '')
  const [pathPart, queryPart = ''] = raw.split('?')
  const segs = pathPart.replace(/^\/+/, '').split('/').filter(Boolean)
  const params = Object.fromEntries(new URLSearchParams(queryPart))
  const page = segs[0] || 'landing'
  if (page === 'region') return { page, id: decodeURIComponent(segs.slice(1).join('/')), params }
  if (page === 'check') return { page, ticker: segs[1] ? decodeURIComponent(segs[1]).toUpperCase() : '', params }
  if (page === 'compare') return { page, params, mw: Number(params.mw) || 300, metros: (params.metros || '').split('|').map(s => s.trim()).filter(Boolean) }
  return { page, params }
}

export const href = {
  landing: () => '#/',
  check: (t, evidence) => `#/check/${encodeURIComponent(t)}${evidence ? '?evidence=1' : ''}`,
  compare: ({ mw = 300, metros = [], evidence }) => `#/compare?mw=${mw}&metros=${encodeURIComponent(metros.join('|'))}${evidence ? '&evidence=1' : ''}`,
  found: s => (s ? `#/found?s=${s}` : '#/found'),
  region: id => `#/region/${encodeURIComponent(id)}`,
  method: () => '#/method',
  screen: by => (by ? `#/screen?by=${by}` : '#/screen'),
}

export function useHash() {
  const [h, setH] = useState(window.location.hash)
  useEffect(() => { const f = () => setH(window.location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  return h
}
