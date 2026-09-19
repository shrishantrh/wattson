import { CommandPalette } from './CommandPalette.jsx'
import { openPalette } from '../lib/commands.js'

// The one box, compact form for the top bar: a button that opens the command palette.
// Renders its own <CommandPalette /> so the top bar works on its own; if the app also mounts
// one at the root, only the earliest-mounted instance is live, so nothing doubles up.
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')

export default function QuickSearch() {
  return (
    <>
      <button type="button" className="quick" onClick={() => openPalette(true)} aria-haspopup="dialog" aria-label={`Search or ask (${isMac ? 'Command' : 'Control'} K)`}>Search or ask… <span className="k">{isMac ? '⌘K' : 'Ctrl K'}</span></button>
      <CommandPalette />
    </>
  )
}
