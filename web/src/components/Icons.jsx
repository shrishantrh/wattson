// Wattson icon set. 24-unit grid, 1.5 stroke, round caps and joins, no fill (except the
// six dots of Drag). Each icon takes `size` (px, default 16) and passes everything else to
// the <svg>, so className, style, onClick and aria-* all work. Decorative by default
// (aria-hidden); pass aria-hidden={false} and aria-label for a meaningful icon.
// Drawn by hand in the Lucide idiom. ICONS is the same set as a name -> component map.

function Svg({ size = 16, children, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

export function Search(props) {
  return <Svg {...props}><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4.5 4.5" /></Svg>
}

export function Pin(props) {
  return <Svg {...props}><path d="M12 21.5s-7-5.8-7-11.3a7 7 0 0 1 14 0c0 5.5-7 11.3-7 11.3Z" /><circle cx="12" cy="10.2" r="2.5" /></Svg>
}

export function Table(props) {
  return <Svg {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9.5h18M3 15h18M9.5 9.5V20" /></Svg>
}

export function Layers(props) {
  return <Svg {...props}><path d="m12 3 9 4.75L12 12.5 3 7.75 12 3Z" /><path d="m3 12.25 9 4.75 9-4.75" /><path d="m3 16.75 9 4.75 9-4.75" /></Svg>
}

export function Sun(props) {
  return <Svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2.5V4.5M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></Svg>
}

export function Moon(props) {
  return <Svg {...props}><path d="M21 13.2A8.4 8.4 0 0 1 10.8 3a8.4 8.4 0 1 0 10.2 10.2Z" /></Svg>
}

export function ZoomIn(props) {
  return <Svg {...props}><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4.5 4.5M11 8v6M8 11h6" /></Svg>
}

export function ZoomOut(props) {
  return <Svg {...props}><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4.5 4.5M8 11h6" /></Svg>
}

export function Close(props) {
  return <Svg {...props}><path d="M6 6l12 12M18 6 6 18" /></Svg>
}

export function Drag(props) {
  return (
    <Svg {...props}>
      <g fill="currentColor" stroke="none">
        <circle cx="9" cy="6" r="1.3" /><circle cx="15" cy="6" r="1.3" />
        <circle cx="9" cy="12" r="1.3" /><circle cx="15" cy="12" r="1.3" />
        <circle cx="9" cy="18" r="1.3" /><circle cx="15" cy="18" r="1.3" />
      </g>
    </Svg>
  )
}

export function Csv(props) {
  return <Svg {...props}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /><path d="M8.5 12h7M8.5 15h7M8.5 18h7" /></Svg>
}

export function Link(props) {
  return <Svg {...props}><path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4L11.8 5.8" /><path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.6 2.6a4.5 4.5 0 0 0 6.4 6.4l1.3-1.3" /></Svg>
}

export function Info(props) {
  return <Svg {...props}><circle cx="12" cy="12" r="9.25" /><path d="M12 11v5.5M12 7.75h.01" /></Svg>
}

export function Keyboard(props) {
  return <Svg {...props}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" /></Svg>
}

export function Copy(props) {
  return <Svg {...props}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15h-.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></Svg>
}

export function Check(props) {
  return <Svg {...props}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>
}

export function ArrowRight(props) {
  return <Svg {...props}><path d="M4 12h16M14 6l6 6-6 6" /></Svg>
}

export function ArrowLeft(props) {
  return <Svg {...props}><path d="M20 12H4M10 6l-6 6 6 6" /></Svg>
}

export function ChevronDown(props) {
  return <Svg {...props}><path d="m6 9 6 6 6-6" /></Svg>
}

export function ChevronUp(props) {
  return <Svg {...props}><path d="m6 15 6-6 6 6" /></Svg>
}

export function Globe(props) {
  return <Svg {...props}><circle cx="12" cy="12" r="9.25" /><path d="M2.75 12h18.5" /><path d="M12 2.75c-2.6 2.6-3.9 5.7-3.9 9.25s1.3 6.65 3.9 9.25c2.6-2.6 3.9-5.7 3.9-9.25S14.6 5.35 12 2.75Z" /></Svg>
}

export function Map2D(props) {
  return <Svg {...props}><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" /><path d="M9 4v14M15 6v14" /></Svg>
}

export function Filter(props) {
  return <Svg {...props}><path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5Z" /></Svg>
}

export function Reset(props) {
  return <Svg {...props}><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6.02L3.5 8.5" /><path d="M3.5 3.5v5h5" /></Svg>
}

// oxlint-disable-next-line react/only-export-components
export const ICONS = {
  Search, Pin, Table, Layers, Sun, Moon, ZoomIn, ZoomOut, Close, Drag, Csv, Link, Info, Keyboard,
  Copy, Check, ArrowRight, ArrowLeft, ChevronDown, ChevronUp, Globe, Map2D, Filter, Reset,
}
