// Evidence modules for a region page. MODULES is a registry of { id, title, applies(ctx), render(ctx) }
// with ctx = { detail, region_id, load_mw?, alerts? }:
//   detail     a region detail from lib/data.js loadRegion(). Zones report demand only and inherit
//              the parent grid's generation, so generation figures read from detail.parent when
//              detail.type === 'zone' (gridOf below); demand and the detector read from detail itself.
//   region_id  "PJM" or "PJM/DOM".
//   alerts     the alerts payload if the caller already loaded it; the alerts module loads it otherwise.
// applies() is false when the data a module needs is absent, so a caller never renders an empty module.
// render() returns a node without an outer card; the caller wraps it and shows `title`.
// The views live in the .jsx files next to this one and export only a component (fast refresh).
import { createElement } from 'react'
import '../../styles/modules.css'
import HeatmapView from './HeatmapModule.jsx'
import FuelDeltaView from './FuelDeltaModule.jsx'
import OperatorsView from './OperatorsModule.jsx'
import DetectorView from './DetectorModule.jsx'
import AlertsView from './AlertsModule.jsx'
import HistoryView from './HistoryModule.jsx'

const isObj = x => x != null && typeof x === 'object' && !Array.isArray(x)
const nonEmpty = a => Array.isArray(a) && a.length > 0
const isNum = x => x != null && x !== '' && !Number.isNaN(Number(x))

// The grid whose generation serves this region: the parent BA for a zone, the region itself for a BA.
export const gridOf = detail => (detail && detail.type === 'zone' && isObj(detail.parent) ? detail.parent : detail || null)
const gridLabel = detail => { const g = gridOf(detail); return g?.id || g?.ba || detail?.ba || null }

// ---- selectors: null when the module has nothing to show ----
export const heatmapOf = detail => {
  const hm = detail?.heatmap ?? gridOf(detail)?.heatmap ?? null
  return isObj(hm) && nonEmpty(hm.cf_share) ? hm : null
}
export const fuelDeltaOf = detail => {
  const d = gridOf(detail)?.fuel_delta_overnight_gw ?? detail?.fuel_delta_overnight_gw
  return isObj(d) && Object.values(d).some(isNum) ? d : null
}
export const operatorsOf = detail => {
  const ops = nonEmpty(detail?.operators_manual) ? detail.operators_manual : nonEmpty(detail?.operators) ? detail.operators : []
  return ops.filter(o => isObj(o) && (o.utility || o.parent || o.ticker))
}
export const detectionOf = detail => (isObj(detail?.detection) && (isNum(detail.detection.score) || isNum(detail.detection.rank)) ? detail.detection : null)
export const cfShareOf = detail => {
  const cf = gridOf(detail)?.cf_share ?? detail?.cf_share
  return isObj(cf) && Object.values(cf).some(y => isObj(y) && (isNum(y.overnight) || isNum(y.daytime))) ? cf : null
}
const demandOf = detail => (isObj(detail?.demand) && Object.values(detail.demand).some(y => isObj(y) && isNum(y.overnight_avg_mw)) ? detail.demand : null)

// ---- the modules ----
export const HeatmapModule = {
  id: 'heatmap', title: 'Clean share every hour of 2025',
  applies: ctx => !!heatmapOf(ctx?.detail),
  render: ctx => createElement(HeatmapView, { hm: heatmapOf(ctx?.detail) }),
}
export const FuelDeltaModule = {
  id: 'fuel-delta', title: 'What changed at night since 2019',
  applies: ctx => !!fuelDeltaOf(ctx?.detail),
  render: ctx => createElement(FuelDeltaView, { delta: fuelDeltaOf(ctx?.detail), grid: gridLabel(ctx?.detail), inherited: !!ctx?.detail?.cf_inherited_from_ba }),
}
export const OperatorsModule = {
  id: 'operators', title: 'Who serves the load',
  applies: ctx => operatorsOf(ctx?.detail).length > 0,
  render: ctx => createElement(OperatorsView, { operators: operatorsOf(ctx?.detail) }),
}
export const DetectorModule = {
  id: 'detector', title: 'How the detector scored it',
  applies: ctx => !!detectionOf(ctx?.detail),
  render: ctx => createElement(DetectorView, { detection: detectionOf(ctx?.detail) }),
}
export const AlertsModule = {
  id: 'alerts', title: 'Alerts here',
  applies: ctx => !!ctx?.region_id,
  render: ctx => createElement(AlertsView, { region_id: ctx?.region_id, alerts: ctx?.alerts, detail: ctx?.detail }),
}
export const HistoryModule = {
  id: 'history', title: 'Clean at night, year by year',
  applies: ctx => !!cfShareOf(ctx?.detail),
  render: ctx => createElement(HistoryView, { cf_share: cfShareOf(ctx?.detail), demand: demandOf(ctx?.detail), grid: gridLabel(ctx?.detail), inherited: !!ctx?.detail?.cf_inherited_from_ba }),
}

export const MODULES = [HeatmapModule, FuelDeltaModule, OperatorsModule, DetectorModule, AlertsModule, HistoryModule]
export const moduleById = id => MODULES.find(m => m.id === id) || null
export const applicableModules = ctx => MODULES.filter(m => m.applies(ctx))
