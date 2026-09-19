import { CommandPalette } from './CommandPalette.jsx'
import { openPalette } from '../lib/commands.js'
import '../styles/states.css'

// The one box, compact form for the top bar: a button that opens the command palette.
// Renders its own <CommandPalette /> so the top bar works on its own; if the app also mounts
// one at the root, only the earliest-mounted instance is live, so nothing doubles up.
// A native <button> opens on Enter and Space by itself; the keydown handler makes that explicit
// (and swallows the follow-up click so it cannot open twice). The .st-quick class draws the
// focus ring (:focus-visible only, so mouse clicks stay quiet); aria-keyshortcuts names the hotkey.
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
const onKey = e => { if ((e.key === 'Enter' || e.key === ' ') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); openPalette(true) } }

export default function QuickSearch() {
  return (
    <>
      <button type="button" className="quick st-quick" onClick={() => openPalette(true)} onKeyDown={onKey} aria-haspopup="dialog" aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'} aria-label={`Search or ask (${isMac ? 'Command' : 'Control'} K)`}>Search or ask… <span className="k">{isMac ? '⌘K' : 'Ctrl K'}</span></button>
      <CommandPalette />
    </>
  )
}
