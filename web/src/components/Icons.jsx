// Wattson icon set. One drawing system, no exceptions:
//   · a 24-unit grid, viewBox 0 0 24 24, rendered at 16px unless a call site says otherwise
//   · stroke 1.5, round caps, round joins, fill none (the six dots of Drag are the one
//     deliberate fill; Pause is two round-capped strokes, not two filled bars)
//   · corners at r=2
//   · one optical square. Glyphs made of area (a rect, a circle, a table) sit inside
//     3..21, about 17 units. Glyphs made of a line or two (a chevron, an X, a check,
//     a play triangle) sit inside roughly 5.5..18.5, about 13 units, because the same
//     bounding box would make them shout. They used to sit inside 6.25..17.75, which was
//     small enough that a chevron read lighter than the table icon beside it at 16px.
// Each icon takes `size` (px, default 16) and passes everything else to the <svg>, so className,
// style, onClick and aria-* all work. Decorative by default (aria-hidden); pass aria-hidden={false}
// and aria-label for a meaningful icon. Drawn by hand in the Lucide idiom, not copied from it.
// ICONS is the same set as a name -> component map.

function Svg({ size = 16, children, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

/* ---- find, mark, arrange ---- */

export function Search(props) {
  return <Svg {...props}><circle cx="10.75" cy="10.75" r="6.75" /><path d="m15.7 15.7 4.3 4.3" /></Svg>
}

export function Pin(props) {
  return <Svg {...props}><path d="M12 21c-4-4.3-6-7.5-6-9.9A6 6 0 0 1 18 11c0 2.4-2 5.6-6 10Z" /><circle cx="12" cy="11" r="2.25" /></Svg>
}

export function Place(props) {
  return <Svg {...props}><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="7.5" /></Svg>
}

export function Table(props) {
  return <Svg {...props}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" /></Svg>
}

export function Layers(props) {
  return <Svg {...props}><path d="m12 3.5 8.5 4.25L12 12 3.5 7.75 12 3.5Z" /><path d="m3.5 12 8.5 4.25L20.5 12" /><path d="m3.5 16.25 8.5 4.25 8.5-4.25" /></Svg>
}

export function Filter(props) {
  return <Svg {...props}><path d="M3.5 5.5h17l-6.75 7.75v5.5l-3.5 1.75v-7.25L3.5 5.5Z" /></Svg>
}

export function Sort(props) {
  return <Svg {...props}><path d="M7 4.5v15M7 4.5 4 7.5M7 4.5l3 3" /><path d="M17 19.5v-15M17 19.5l-3-3M17 19.5l3-3" /></Svg>
}

export function Reset(props) {
  return <Svg {...props}><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /></Svg>
}

export function Drag(props) {
  return (
    <Svg {...props}>
      <g fill="currentColor" stroke="none">
        <circle cx="9.5" cy="6" r="1.25" /><circle cx="14.5" cy="6" r="1.25" />
        <circle cx="9.5" cy="12" r="1.25" /><circle cx="14.5" cy="12" r="1.25" />
        <circle cx="9.5" cy="18" r="1.25" /><circle cx="14.5" cy="18" r="1.25" />
      </g>
    </Svg>
  )
}

/* ---- day, night, power, time ---- */

export function Sun(props) {
  return <Svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 3v2.25M12 18.75V21M3 12h2.25M18.75 12H21M5.64 5.64l1.6 1.6M16.76 16.76l1.6 1.6M18.36 5.64l-1.6 1.6M7.24 16.76l-1.6 1.6" /></Svg>
}

export function Moon(props) {
  return <Svg {...props}><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" /></Svg>
}

export function Day(props) {
  return <Svg {...props}><path d="M3.5 18h17" /><circle cx="12" cy="13.5" r="3.75" /><path d="M12 4.5v2M4.6 8.1l1.4 1.4M19.4 8.1 18 9.5" /></Svg>
}

export function Night(props) {
  return <Svg {...props}><path d="M19.5 14.6A7.6 7.6 0 0 1 10 5a7.6 7.6 0 1 0 9.5 9.6Z" /><path d="M6 4.5v2.4M4.8 5.7h2.4" /></Svg>
}

export function Bolt(props) {
  return <Svg {...props}><path d="M13.5 3 5.5 13.5h5.5L10.5 21l8-10.5H13L13.5 3Z" /></Svg>
}

export function Clock(props) {
  return <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.25V12l3.25 2" /></Svg>
}

/* ---- views ---- */

export function Globe(props) {
  return <Svg {...props}><circle cx="12" cy="12" r="8.75" /><path d="M3.25 12h17.5" /><path d="M12 3.25c2.4 2.4 3.6 5.3 3.6 8.75S14.4 18.35 12 20.75c-2.4-2.4-3.6-5.3-3.6-8.75S9.6 5.65 12 3.25Z" /></Svg>
}

export function Map2D(props) {
  return <Svg {...props}><path d="m3.5 6.25 5.75-2 5.5 2 5.75-2v13.5l-5.75 2-5.5-2-5.75 2V6.25Z" /><path d="M9.25 4.25v13.5M14.75 6.25v13.5" /></Svg>
}

export function ZoomIn(props) {
  return <Svg {...props}><circle cx="10.75" cy="10.75" r="6.75" /><path d="m15.7 15.7 4.3 4.3" /><path d="M10.75 8v5.5M8 10.75h5.5" /></Svg>
}

export function ZoomOut(props) {
  return <Svg {...props}><circle cx="10.75" cy="10.75" r="6.75" /><path d="m15.7 15.7 4.3 4.3" /><path d="M8 10.75h5.5" /></Svg>
}

/* ---- people, places, files ---- */

export function Company(props) {
  return <Svg {...props}><path d="M3.5 20.5h17" /><path d="M4.5 20.5V7.25L12 4l7.5 3.25V20.5" /><path d="M8.5 10.5h2M13.5 10.5h2M8.5 14h2M13.5 14h2" /><path d="M10 20.5v-3h4v3" /></Svg>
}

export function Csv(props) {
  return <Svg {...props}><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Z" /><path d="M13.5 3.5V9H19" /><path d="M8.5 12.5h7M8.5 16h4.5" /></Svg>
}

export function Download(props) {
  return <Svg {...props}><path d="M12 3.5v11.5" /><path d="m7.75 10.75 4.25 4.25 4.25-4.25" /><path d="M4.5 17.5v1a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1" /></Svg>
}

export function Link(props) {
  return <Svg {...props}><path d="M10.5 13.5a4.25 4.25 0 0 0 6 0l2.25-2.25a4.25 4.25 0 0 0-6-6L11.5 6.5" /><path d="M13.5 10.5a4.25 4.25 0 0 0-6 0L5.25 12.75a4.25 4.25 0 0 0 6 6l1.25-1.25" /></Svg>
}

export function External(props) {
  return <Svg {...props}><path d="M19.5 13.5v5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h5" /><path d="M14.5 3.5h6v6" /><path d="m20.5 3.5-8 8" /></Svg>
}

export function Copy(props) {
  return <Svg {...props}><rect x="9" y="9" width="11.5" height="11.5" rx="2" /><path d="M5.5 15h-.5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 3h9a1.5 1.5 0 0 1 1.5 1.5V5" /></Svg>
}

/* ---- state and transport ---- */

export function Close(props) {
  return <Svg {...props}><path d="M5.75 5.75 18.25 18.25M18.25 5.75 5.75 18.25" /></Svg>
}

export function Check(props) {
  return <Svg {...props}><path d="m4.25 12.5 5 5L19.75 6.75" /></Svg>
}

export function Info(props) {
  return <Svg {...props}><circle cx="12" cy="12" r="8.75" /><path d="M12 11.25V16.5" /><path d="M12 7.75h.01" /></Svg>
}

export function Help(props) {
  return <Svg {...props}><circle cx="12" cy="12" r="8.75" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.35 2.35c-.55.2-.85.7-.85 1.3v.6" /><path d="M12 16.75h.01" /></Svg>
}

export function Play(props) {
  return <Svg {...props}><path d="M7 4.5 19.5 12 7 19.5V4.5Z" /></Svg>
}

export function Pause(props) {
  return <Svg {...props}><path d="M8.75 4.5v15M15.25 4.5v15" /></Svg>
}

export function Keyboard(props) {
  return <Svg {...props}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M6.5 10h.02M10 10h.02M13.5 10h.02M17 10h.02M6.5 14h.02M17 14h.02M9.5 14h5" /></Svg>
}

/* ---- direction ---- */

export function ArrowRight(props) {
  return <Svg {...props}><path d="M4.25 12h15.5M13.75 6l6 6-6 6" /></Svg>
}

export function ArrowLeft(props) {
  return <Svg {...props}><path d="M19.75 12H4.25M10.25 6l-6 6 6 6" /></Svg>
}

export function ChevronDown(props) {
  return <Svg {...props}><path d="m5.75 8.75 6.25 6.25 6.25-6.25" /></Svg>
}

export function ChevronUp(props) {
  return <Svg {...props}><path d="m5.75 15.25 6.25-6.25 6.25 6.25" /></Svg>
}

export function ChevronRight(props) {
  return <Svg {...props}><path d="m9.5 5.75 6.25 6.25-6.25 6.25" /></Svg>
}

export function ChevronLeft(props) {
  return <Svg {...props}><path d="m14.5 5.75-6.25 6.25 6.25 6.25" /></Svg>
}

export function ArrowUp(props) {
  return <Svg {...props}><path d="M12 20V4.5M6 10.5l6-6 6 6" /></Svg>
}

export function ArrowDown(props) {
  return <Svg {...props}><path d="M12 4v15.5M6 13.5l6 6 6-6" /></Svg>
}

export function Plus(props) {
  return <Svg {...props}><path d="M12 5.5v13M5.5 12h13" /></Svg>
}

export function Minus(props) {
  return <Svg {...props}><path d="M5.5 12h13" /></Svg>
}

// the amber case: a figure that is flagged, corrected or provisional
export function Warning(props) {
  return <Svg {...props}><path d="M12 3.75 21 19.5H3l9-15.75Z" /><path d="M12 10v4.25" /><path d="M12 17.5h.01" /></Svg>
}

// oxlint-disable-next-line react/only-export-components
export const ICONS = {
  Search, Pin, Place, Table, Layers, Filter, Sort, Reset, Drag,
  Sun, Moon, Day, Night, Bolt, Clock,
  Globe, Map2D, ZoomIn, ZoomOut,
  Company, Csv, Download, Link, External, Copy,
  Close, Check, Info, Help, Play, Pause, Keyboard,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Plus, Minus, Warning,
}
