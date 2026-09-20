import { useEffect, useState } from 'react'

// #/ landing · #/screen?by=preset · #/check/META · #/compare?mw=300&metros=a|b|c · #/found?s=scene · #/region/<id> · #/method · #/ask?q=anything
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
  // `vs` opens the side-by-side screen over this page: vs=<mode>:<left>,<right>, as in
  // vs=company:META,GOOGL. No id in the data holds a comma or a colon, so the link stays readable.
  compare: ({ mw = 300, metros = [], evidence, vs }) => `#/compare?mw=${mw}&metros=${encodeURIComponent(metros.join('|'))}${evidence ? '&evidence=1' : ''}${vs ? `&vs=${encodeURIComponent(vs)}` : ''}`,
  found: s => (s ? `#/found?s=${s}` : '#/found'),
  region: id => `#/region/${encodeURIComponent(id)}`,
  method: () => '#/method',
  irradiance: () => '#/irradiance',
  alpha: () => '#/alpha',
  screen: by => (by ? `#/screen?by=${by}` : '#/screen'),
  alerts: () => '#/alerts',
  data: t => (t ? `#/data?t=${t}` : '#/data'),
  companies: () => '#/companies',
  ask: q => (q ? `#/ask?q=${encodeURIComponent(q)}` : '#/ask'),
  explore: (params) => { const q = new URLSearchParams(params || {}).toString(); return q ? `#/explore?${q}` : '#/explore' },
}

export function useHash() {
  const [h, setH] = useState(window.location.hash)
  useEffect(() => { const f = () => setH(window.location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  return h
}
