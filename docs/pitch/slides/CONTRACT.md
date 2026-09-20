# Slide fragment contract

Each agent writes ONE file: docs/pitch/slides/<NN>-<name>.html
It contains only <section> blocks. No <html>, <head>, <style>, <script>, no external URLs.

<section class="slide" data-title="Short title" data-notes="What the presenter says and knows. Any length.">
  ... content ...
</section>

## Classes the shell provides (use these, do not invent CSS)
.eyebrow   small uppercase kicker, accent colour
.headline  the one statement of the slide
.sub       the explanatory line; ALWAYS legible, never a footnote
.big       a display number
.label     the words under a .big
.rowa      horizontal group, evenly spaced
.cola      vertical group
.rule      short accent underline
.note      quiet provenance line
.muted     de-emphasised text

## CSS variables (never hardcode colour)
--ink --ink-2 --muted --bg --surface --surface-2 --line --line-soft --line-strong
--clean  = clean power ONLY      --fossil = fossil ONLY
--warn   = flagged/corrected data ONLY
--accent = the one accent, and it means NOTHING about generation
  (also --clean-soft/-line, --fossil-soft/-line, --warn-soft, --accent-soft/-line)

## Gotchas (both fixed in the shell on 2026-09-20 — re-read if you worked around them)

**1. `fill=` on SVG text now works.** It used not to: the shell had
`.slide svg text { fill: var(--ink) }`, and a CSS declaration silently beats a
presentation attribute, so `<text fill="var(--clean)">` rendered ink with no error.
The rule is now `:not([fill]):not([style*="fill"])`, so an explicit colour wins.
Write `fill="var(--clean)"`. If you switched to `style="fill:..."` as a workaround,
that still works and you do not have to change it.

**2. `--accent` is no longer orange.** In the app `--accent` aliases `--fossil`, which
in a deck about clean versus fossil made every eyebrow and rule read as "gas". The deck
gives the accent a hue of its own (violet, `#a78bfa`, 7.3:1 on the page). It is safe in
charts: it cannot be confused with `--clean`, `--fossil` or `--warn`, and it asserts
nothing about generation. Use it for structure and emphasis, never for a fuel.

## Type tokens
--t-hero --t-big --t-h1 --t-h2 --t-lead --t-body --t-small --t-micro
Nothing carrying meaning below --t-body on a slide.
The shell sizes .sub at --t-lead, which is 0.73 of the .headline size, NOT a footnote.
Write .sub as a real sentence: it is the line that makes the slide comprehensible.
Add `class="headline hero"` for a single-statement slide (opener, close).

## Building
`node docs/pitch/build-deck.mjs` assembles docs/pitch/deck.html and prints a word count per
slide. `--check` validates without writing. It fails the build on: over 15 visible words
(but see the exception below),
a <style>, <script> or inline handler, an external URL, a duplicate data-title, a <section>
without class="slide" or data-title, or a fragment with no <section> at all.

## Running order (one file each, assembled in filename order)
01-problem · 02-concepts · 04-demo · 08-close

`02-concepts` was added on 2026-09-20, after the cut described below. The demo teaches
nothing to a judge who does not already know what a grid region is or what a clean share
measures; that judge nods along and scores low. The concepts fragment lays out the two
terms and the six steps of the argument, in plain sentences, before the site is opened.
Its source is `docs/UNDERSTAND.md` sections 1, 2 and 3.

Cut to three files on 2026-09-20. The pitch is the live demo in `docs/DEMO.md`; the deck is
a cold open spoken before any screen is touched, a holding slide while the site is driven,
and a close. `02-solution`, `03-howitworks`, `05-results`, `06-rigor` and `07-stack` were
retired to `slides/retired/` because the demo shows all five live, and a second telling on a
slide is how the two drift apart. The running order lives in `build-deck.mjs`; a file left
in `slides/` but absent from it is appended at the end, not dropped, so retire by moving.

A missing file does not break the build: the assembler emits a loud amber placeholder
slide in its place. Numbered files outside this list (09+, 90+) are appended at the end.

## Backup slides
Add `data-backup="1"` to a <section> to park it after the main run. `B` jumps to the first
backup slide and `B` again returns to where the presenter was. Backup slides obey every
other rule here, including the 15-word cap.

## The one word-cap exception
`02-concepts.html` has a cap of **25** visible words per slide. Every other fragment,
present and future, stays at 15.

**The reason.** Every other slide punctuates a live demo: the presenter is talking, the
screen is a beat, and fifteen words is generous. The concepts slides are spoken before any
screen is touched and each one has to carry a definition *and* its consequence — "clean
share is what the wires physically carried" is worth nothing without "it is not what any
company bought" beside it. A second sentence is the smallest unit that teaches.

**25 is a ceiling, not a target.** Most of those slides come in at 20 to 24, and one is 15.

It is enforced per file in `build-deck.mjs` (`WORD_CAP_EXCEPTIONS`), deliberately rather
than by relaxing `MAX_WORDS`, so no other fragment can drift into the allowance. The
assembly report prints `(cap 25)` next to any slide running under an exception. Do not add
a second entry to that map without the owner's say-so.

## Hard rules
- Max 15 words of VISIBLE text per slide, 25 in `02-concepts.html` only. Everything else
  goes in data-notes.
- One `class="slide"` and one `data-title` per <section>. Titles must be unique across all
  fragments; a collision fails the build and names both files.
- Nothing outside a <section> survives assembly. The assembler warns if you leave text there.
- Inline SVG is encouraged for any number that is a comparison. Use the variables via
  fill="var(--clean)" etc. viewBox only, no fixed width/height.
- Every figure must exist in docs/pitch/numbers.md or numbers-v2.md. Cite it in data-notes.
- Honesty rules in CLAUDE.md apply to every word.
