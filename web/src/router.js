import { useEffect, useState } from 'react'

// Hash routes: #/ (opening; ?s=<scene> for scripted scenes), #/verify[/TICKER], #/site, #/region/<id>, #/method
export function parseHash(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '')
  const [pathPart, queryPart = ''] = raw.split('?')
  const segs = pathPart.replace(/^\/+/, '').split('/').filter(Boolean)
  const params = Object.fromEntries(new URLSearchParams(queryPart))
  const page = segs[0] || 'opening'
  if (page === 'region') return { page, id: decodeURIComponent(segs.slice(1).join('/')), params }
  if (page === 'verify') return { page, ticker: segs[1] ? decodeURIComponent(segs[1]).toUpperCase() : '', params }
  return { page, params }
}

export const href = {
  opening: scene => (scene ? `#/?s=${scene}` : '#/'),
  region: id => `#/region/${encodeURIComponent(id)}`,
  verify: t => (t ? `#/verify/${encodeURIComponent(t)}` : '#/verify'),
  site: () => '#/site',
  method: () => '#/method',
}

export function useHash() {
  const [h, setH] = useState(window.location.hash)
  useEffect(() => {
    const f = () => setH(window.location.hash)
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return h
}
