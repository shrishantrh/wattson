// What the user is looking at, as a pointer for resolving "this" and "here".
//
// Deliberately small and deliberately NOT a source of truth. The server re-fetches every
// figure it reports; this only tells the model which region, company or comparison the
// question is about. Sending the whole screen would invite the model to answer from a
// snapshot rather than from the data.
import { parseHash } from '../router.js'

export function pageContext() {
  const route = parseHash(window.location.hash) || {}
  const ctx = { route: route.page || 'landing' }
  if (route.id) ctx.region_id = route.id
  if (route.ticker) ctx.ticker = String(route.ticker).toUpperCase()
  if (route.metros?.length) { ctx.metros = route.metros; ctx.mw = route.mw || 300 }
  if (route.s) ctx.scene = route.s
  if (route.by) ctx.screen = route.by
  return ctx
}
