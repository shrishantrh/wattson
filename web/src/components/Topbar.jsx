const NAV = [['opening', 'Opening', '#/'], ['verify', 'Verify', '#/verify'], ['site', 'Site', '#/site'], ['method', 'Method', '#/method']]

export default function Topbar({ page }) {
  return (
    <header className="topbar">
      <a className="brand" href="#/">
        <span className="wordmark">Wattson</span>
        <span className="tagline">It follows the power, not the press release.</span>
      </a>
      <nav className="nav">
        {NAV.map(([k, label, h]) => <a key={k} href={h} className={page === k ? 'active' : ''}>{label}</a>)}
      </nav>
    </header>
  )
}
