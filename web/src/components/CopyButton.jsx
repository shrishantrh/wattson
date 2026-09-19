import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from './Icons.jsx'
import { toast } from './Toast.jsx'
import '../styles/primitives.css'

// <CopyButton text="https://…" /> or text={() => buildLink()}. Copies via the async
// clipboard API with a hidden-textarea fallback, swaps to the Check icon and `copiedLabel`
// for 1.6 s, and raises a toast (`toastMessage`, default 'Link copied'; pass null to skip).

const COPIED_MS = 1600

// oxlint-disable-next-line react/only-export-components
export async function copyText(s) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(s); return true }
  } catch { /* fall through to the textarea path */ }
  const ta = document.createElement('textarea')
  ta.value = s
  ta.setAttribute('readonly', '')
  ta.setAttribute('aria-hidden', 'true')
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, s.length)
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  document.body.removeChild(ta)
  return ok
}

export function CopyButton({ text, label = 'Copy link', copiedLabel = 'Copied', toastMessage = 'Link copied', className = '', size = 14, title, ...rest }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const onClick = async () => {
    const s = String(typeof text === 'function' ? text() : text ?? '')
    const ok = await copyText(s)
    if (!ok) { toast('Could not copy'); return }
    setCopied(true)
    if (toastMessage) toast(toastMessage)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  const Icon = copied ? Check : Copy
  return (
    <button type="button" className={`copy-btn${copied ? ' copied' : ''}${className ? ` ${className}` : ''}`} onClick={onClick} aria-label={label} title={title ?? label} aria-live="polite" {...rest}>
      <Icon size={size} />
      <span>{copied ? copiedLabel : label}</span>
    </button>
  )
}

export default CopyButton
