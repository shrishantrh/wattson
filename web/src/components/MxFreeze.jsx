import { Section } from '../console/widgets.jsx'
import './Mx.css'

// The freeze evidence, stated as the repository states it and no further. Every figure below was
// read off `git log --follow scripts/l3_detector.py`, `git show --numstat c421061` and the diff
// between the two commits; nothing here is a claim the commit graph does not already make.
//
// The claim is narrow on purpose: the four validation regions are named in the same commit that
// created the code which first produced the ranking, and the scoring function has not been
// touched since. There is no separate signed pre-registration document and the page does not
// pretend there is one.
const COMMITS = [
  {
    sha: '7dc87a0',
    when: '19 Sep 2026, 13:12',
    subject: 'L3: flat-load detector over all subregions and BAs, 2019 to 2025',
    stat: ['+160', ''],
    body: <>The file&rsquo;s first version, and the run that produced the ranking. It already carries the scoring function, the 500 MW floor, the 99.5th percentile peak <b>and the four region names</b>, in the same 160 lines.</>,
  },
  {
    sha: 'c421061',
    when: '19 Sep 2026, 13:21',
    subject: 'L4: overnight fuel mix by BA and year, siting score with ratio slope; L3 pattern labels (method frozen)',
    stat: ['+22', '-0'],
    body: <>The only later edit: a docstring block, and a <b>descriptive</b> pattern label whose own docstring reads <i>&ldquo;Descriptive label only; does not affect the score or rank&rdquo;</i>. Nothing is removed, and the diff never reaches the score, the z-scores or the rank.</>,
  },
]

// Verbatim from scripts/l3_detector.py as committed in 7dc87a0, with long argument lists elided
// where they run off the line. The two print calls are the pre-registration: the first asks for
// the four regions' ranks, the second asks for them again on a second window.
const SNIPPET = `scripts/l3_detector.py @ 7dc87a0

print("\\nVALIDATION SET:")
print(r[r.region.isin(
    ["PJM/DOM", "PJM/AEP", "SWPP/OPPD",
     "ERCO/NCEN", "PJM", "ERCO", "SWPP"])]...)

print("\\n2026 Jan-Aug ranks for"
      " validation set:")
print(r26[r26.region.isin(
    ["PJM/DOM", "PJM/AEP",
     "SWPP/OPPD", "ERCO/NCEN"])]...)`

export default function MxFreeze() {
  return (
    <Section title="What the repository records" right={<span className="mono muted" style={{ fontSize: 'var(--t-micro)', whiteSpace: 'nowrap' }}>2 commits, ever</span>}>
      <p className="note">The detector lives in one file, <b>scripts/l3_detector.py</b>, and that file has two commits in its entire history.</p>
      <ul className="mx-git">
        {COMMITS.map(c => (
          <li key={c.sha}>
            <span>
              <span className="sha">{c.sha}</span>
              <span className="when">{c.when}</span>
              <span className="when mx-diffstat"><span className="add">{c.stat[0]}</span>{c.stat[1] ? ` / ${c.stat[1]}` : ''}</span>
            </span>
            <span>
              <span className="what">{c.subject}</span>
              <span className="why">{c.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <code className="mx-code">{SNIPPET}</code>
      <p className="mx-cap">
        Those two prints are the pre-registration, wrapped here to fit the column and otherwise as committed. They name the regions the detector was to be judged on, they ask for their ranks on two separate windows, and they are in the file&rsquo;s first commit. The page claims exactly what the repository shows and nothing beyond it: the names were committed with the code that first produced the ranking, and the scoring function has not changed since.
      </p>
    </Section>
  )
}
