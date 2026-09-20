// Where a pin's tag goes when a dozen pins share the screen.
//
// Both maps (the globe and the 2D fallback) draw the same `.gpin` markup, so the placement is
// one pure function over measured boxes: no DOM here, and no reflow per attempt. Each tag is
// tried on its preferred side first, then the other two; a tag with no free side is hidden
// rather than allowed to overlap, and the order the tags are offered decides who keeps a
// place — the selected pin, then `lead` pins, then data order, which the pages sort by rank.

const LABEL_PAD = 3 // px of clearance between two tags
const EDGE_PAD = 2 // ... and between a tag and the edge of the canvas
const HOVER_GAP = 16 // gap between a hover card and the pin it belongs to
const HOVER_EDGE = 10 // ... and the smallest gap it keeps from the edge of the canvas
const HOVER_CLEAR = 26 // vertical clearance from the pin when the card has to go above or below

/**
 * The box a tag occupies for a given side, in canvas pixels. The three cases mirror the
 * `.gpin-label` rules in base.css: centred over the stem (`translateX(-50%)`, left -2), right
 * edge at left -8 (`.left`), or left edge at left 8 (`.right`).
 * @param {{ ax: number, ay: number, w: number, h: number, stem: number }} it
 * @param {'center'|'left'|'right'} side
 */
export function labelBox(it, side) {
  const left = side === 'left' ? it.ax - 8 - it.w : side === 'right' ? it.ax + 8 : it.ax - 2 - it.w / 2
  const bottom = it.ay - it.stem
  return { l: left, r: left + it.w, t: bottom - it.h, b: bottom }
}

export function boxesOverlap(a, b) {
  return a.l < b.r + LABEL_PAD && b.l < a.r + LABEL_PAD && a.t < b.b + LABEL_PAD && b.t < a.b + LABEL_PAD
}

/** The sides to try for a pin, its own preference first. */
export function sidesFor(d) {
  if (d && d.side === 'left') return ['left', 'right', 'center']
  if (d && d.side === 'right') return ['right', 'left', 'center']
  return ['center', 'right', 'left']
}

/**
 * Give every tag a side, or null when it has to be hidden. Sorts a copy, so the caller's array
 * order (which carries the data order) is left alone.
 * @param {Array<{ d: object, ax: number, ay: number, w: number, h: number, stem: number, prio: number, order: number }>} items
 * @param {number} width canvas width in px
 * @returns {Array<{ item: object, side: 'center'|'left'|'right'|null }>}
 */
export function placeLabels(items, width) {
  const ordered = items.slice().sort((p, q) => q.prio - p.prio || p.order - q.order)
  const placed = []
  const out = []
  for (const it of ordered) {
    let side = null
    for (const s of sidesFor(it.d)) {
      const box = labelBox(it, s)
      if (box.l < EDGE_PAD || box.r > width - EDGE_PAD) continue
      if (placed.some((b) => boxesOverlap(box, b))) continue
      side = s
      placed.push(box)
      break
    }
    out.push({ item: it, side })
  }
  return out
}

/**
 * Where a hover card goes beside its pin: to the right when there is room, otherwise to the
 * left, and above or below when neither side fits. Always inside the canvas, and never over the
 * pin it describes.
 * @param {{ ax: number, ay: number, cw: number, ch: number, width: number, height: number }} a
 * @returns {{ x: number, y: number }}
 */
export function hoverCardPosition({ ax, ay, cw, ch, width, height }) {
  let x = ax + HOVER_GAP
  let sided = true
  if (x + cw > width - HOVER_EDGE) x = ax - HOVER_GAP - cw
  if (x < HOVER_EDGE) {
    sided = false
    x = Math.min(Math.max(HOVER_EDGE, ax - cw / 2), Math.max(HOVER_EDGE, width - cw - HOVER_EDGE))
  }
  let y = sided ? ay - ch / 2 : ay - ch - HOVER_CLEAR
  if (!sided && y < HOVER_EDGE) y = ay + HOVER_CLEAR
  y = Math.min(Math.max(HOVER_EDGE, y), Math.max(HOVER_EDGE, height - ch - HOVER_EDGE))
  // Last guard: after clamping, the card must still not sit on top of its own pin.
  if (ax > x - 4 && ax < x + cw + 4 && ay > y - 4 && ay < y + ch + 4) {
    const above = ay - ch - HOVER_CLEAR
    y = above >= HOVER_EDGE ? above : Math.min(ay + HOVER_CLEAR, Math.max(HOVER_EDGE, height - ch - HOVER_EDGE))
  }
  return { x, y }
}
