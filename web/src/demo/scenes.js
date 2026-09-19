// Scripted walkthrough. 'd' toggles demo mode; → / ← step through these in order.
const q = h => new URLSearchParams(h.split('?')[1] || '')
export const SCENES = [
  { id: 'landing', route: '#/?demo=1', match: h => /^#\/?(\?|$)/.test(h), title: 'Ask' },
  { id: 'check', route: '#/check/META?demo=1', match: h => h.startsWith('#/check/META') && !q(h).get('evidence'), title: 'Check Meta' },
  { id: 'check-evidence', route: '#/check/META?evidence=1&demo=1', match: h => h.startsWith('#/check/META') && !!q(h).get('evidence'), title: 'The evidence' },
  { id: 'compare', route: '#/compare?mw=300&metros=Phoenix%7CNorthern%20Virginia%7COmaha&demo=1', match: h => h.startsWith('#/compare') && !q(h).get('evidence'), title: 'Compare 300 MW' },
  { id: 'compare-evidence', route: '#/compare?mw=300&metros=Phoenix%7CNorthern%20Virginia%7COmaha&evidence=1&demo=1', match: h => h.startsWith('#/compare') && !!q(h).get('evidence'), title: 'Why Omaha' },
  { id: 'screen', route: '#/screen?by=rising&demo=1', match: h => h.startsWith('#/screen'), title: 'The screener' },
  { id: 'found-headline', route: '#/found?s=headline&demo=1', match: h => h.startsWith('#/found') && (q(h).get('s') || 'headline') === 'headline', title: 'What we found' },
  { id: 'found-night', route: '#/found?s=night&demo=1', match: h => h.startsWith('#/found') && q(h).get('s') === 'night', title: 'At night' },
  { id: 'found-sweep', route: '#/found?s=sweep&demo=1', match: h => h.startsWith('#/found') && q(h).get('s') === 'sweep', title: 'Day vs night' },
  { id: 'found-detector', route: '#/found?s=detector&demo=1', match: h => h.startsWith('#/found') && q(h).get('s') === 'detector', title: 'Where load is landing' },
  { id: 'method', route: '#/method?demo=1', match: h => h.startsWith('#/method'), title: 'Method' },
]
