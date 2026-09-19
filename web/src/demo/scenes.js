// Scripted walkthrough. Arrow keys step through these in order; 'd' toggles demo mode.
const openingScene = s => ({ id: s, route: `#/?s=${s}&demo=1`, match: h => /^#\/?(\?|$)/.test(h) && new URLSearchParams(h.split('?')[1] || '').get('s') === s })
export const SCENES = [
  { ...openingScene('headline'), title: 'The finding' },
  { ...openingScene('night'), title: 'The US at night' },
  { ...openingScene('sweep'), title: 'Day cleaned up, night did not' },
  { ...openingScene('detector'), title: '111 regions scored' },
  { id: 'region', route: '#/region/PJM%2FDOM?demo=1', match: h => h.startsWith('#/region/PJM%2FDOM'), title: 'Northern Virginia' },
  { id: 'site', route: '#/site?demo=1', match: h => h.startsWith('#/site'), title: 'Siting 300 MW' },
  { id: 'verify', route: '#/verify/META?demo=1', match: h => h.startsWith('#/verify/META'), title: 'Verify a claim' },
  { id: 'method', route: '#/method?demo=1', match: h => h.startsWith('#/method'), title: 'Method and caveats' },
]
