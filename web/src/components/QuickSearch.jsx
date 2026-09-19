import { CommandPalette } from './CommandPalette.jsx'
import { openPalette } from '../lib/commands.js'
import '../styles/states.css'

// The one box, compact form for the top bar: a button that opens the command palette.
// Renders its own <CommandPalette /> so the top bar works on its own; if the app also mounts
// one at the root, only the earliest-mounted instance is live, so nothing doubles up.
// A native <button> already opens on Enter and Space; the .st-quick class draws the focus ring
// (:focus-visible only, so mouse clicks stay quiet) and aria-keyshortcuts names the hotkey.
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')

export default function QuickSearch() {
  return (
    <>
      <button type="button" className="quick st-quick" onClick={() => openPalette(true)} aria-haspopup="dialog" aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'} aria-label={`Search or ask (${isMac ? 'Command' : 'Control'} K)`}>Search or ask… <span className="k">{isMac ? '⌘K' : 'Ctrl K'}</span></button>
      <CommandPalette />
    </>
  )
}
