const base = import.meta.env.BASE_URL
async function getJSON(path) {
  const res = await fetch(base + path)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('json')) throw new Error(`${path}: not JSON (${ct})`)   // dev server returns index.html for missing files
  return res.json()
}
export const loadRegions = () => getJSON('data/regions.json')
export const loadAlerts = () => getJSON('data/alerts.json')
export const loadHeatmap = uri => getJSON(uri)
const asList = x => (Array.isArray(x) ? x : x?.companies ? x.companies : [x])
export async function loadCompanies() {
  try { return { companies: asList(await getJSON('claims/companies.json')), mock: false } }
  catch { try { return { companies: asList(await getJSON('claims/companies.mock.json')), mock: true } } catch { return { companies: [], mock: true } } }
}
