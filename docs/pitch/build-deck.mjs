#!/usr/bin/env node
// Wattson pitch deck assembler.
//
// Reads every docs/pitch/slides/*.html fragment in filename order, validates each one
// against docs/pitch/slides/CONTRACT.md, and splices the <section> blocks into
// docs/pitch/deck.html between the SLIDES:BEGIN / SLIDES:END markers.
//
// The shell (deck.html outside the markers) is hand-written and is never touched.
// A missing fragment does not break the build: a loud placeholder slide is emitted in
// its place so the gap is visible on screen rather than silently absent.
//
//   node docs/pitch/build-deck.mjs            assemble and report
//   node docs/pitch/build-deck.mjs --check    validate only, write nothing
//
// Exit code 1 on any contract violation.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SLIDES_DIR = join(HERE, 'slides');
const DECK = join(HERE, 'deck.html');
const BEGIN = '<!-- SLIDES:BEGIN -->';
const END = '<!-- SLIDES:END -->';

const MAX_WORDS = 15;

// The running order. Every one of these must exist or a placeholder stands in for it.
//
// Cut down on 2026-09-20. The pitch is now the live demo in docs/DEMO.md; the deck is a
// cold open before any screen is touched, a holding slide while the site is driven, and a
// close. Everything the demo shows live was retired to slides/retired/ rather than kept
// in a second deck that could drift from the demo's wording — 02-solution, 03-howitworks,
// 05-results, 06-rigor, 07-stack. The PJM finding and the prediction survive as backup
// slides in 09-backup.html, for the night the site is down.
const RUNNING_ORDER = [
  ['01', 'problem'],
  ['04', 'demo'],
  ['08', 'close'],
];

const check = process.argv.includes('--check');
const errors = [];
const warnings = [];
const svgFills = [];

// ---------------------------------------------------------------- helpers

// Visible words in a chunk of fragment HTML: drop comments, drop everything that is not
// rendered text (tag names, attributes, and therefore data-notes as well), then count
// tokens that contain at least one alphanumeric character. SVG <text> counts, because the
// room reads it.
function visibleWords(html) {
  const text = stripTags(html)
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return [];
  return text.split(' ').filter((w) => /[a-z0-9]/i.test(w));
}

// Remove markup, respecting quoted attribute values. A naive /<[^>]*>/ counts the tail of
// any data-notes containing a ">" (an arrow, a threshold) as visible slide text, which
// is exactly the false alarm that would send a clean fragment back to its author.
function stripTags(html) {
  let out = '';
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { out += html.slice(i); break; }
    out += html.slice(i, lt) + ' ';
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      i = end === -1 ? n : end + 3;
      continue;
    }
    let j = lt + 1;
    let quote = null;
    while (j < n) {
      const c = html[j];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      j++;
    }
    i = j + 1;
  }
  return out;
}

function splitSections(html) {
  const out = [];
  const re = /<section\b[\s\S]*?<\/section>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[0]);
  return out;
}

function attr(section, name) {
  const m = section.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function placeholder(prefix, name) {
  return `<section class="slide slide--missing" data-title="MISSING ${esc(prefix)}-${esc(name)}" data-notes="No fragment at docs/pitch/slides/${esc(prefix)}-${esc(name)}.html. The agent that owns this slide has not delivered it. Do not present with this on screen.">
  <p class="eyebrow">Slide ${esc(prefix)}</p>
  <h2 class="headline">Missing fragment</h2>
  <p class="sub">${esc(prefix)}-${esc(name)}.html has not been written</p>
</section>`;
}

// ---------------------------------------------------------------- read fragments

if (!existsSync(SLIDES_DIR)) {
  console.error(`FATAL: ${SLIDES_DIR} does not exist.`);
  process.exit(1);
}

const files = readdirSync(SLIDES_DIR)
  .filter((f) => f.toLowerCase().endsWith('.html'))
  .sort();

const titles = new Map(); // data-title -> file
const slides = []; // { file, html, title, words }
const seenPrefixes = new Set();

for (const file of files) {
  const path = join(SLIDES_DIR, file);
  const raw = readFileSync(path, 'utf8');
  const prefix = (file.match(/^(\d+)/) || [])[1] || null;
  if (prefix) seenPrefixes.add(prefix);

  // --- fragment-level contract checks
  if (/<style\b/i.test(raw)) errors.push(`${file}: contains a <style> block. All CSS lives in the shell.`);
  if (/<script\b/i.test(raw)) errors.push(`${file}: contains a <script> block. Fragments are markup only.`);
  if (/\bon[a-z]+\s*=\s*"/i.test(raw)) errors.push(`${file}: contains an inline event handler attribute.`);
  if (/<(html|head|body|!doctype)\b/i.test(raw)) errors.push(`${file}: contains a document-level tag. Fragments are <section> blocks only.`);

  const urls = raw.match(/\b(?:https?:)?\/\/[^\s"'<>)]+/gi) || [];
  const external = urls.filter((u) => !/^\/\/(?:www\.)?w3\.org/i.test(u) && !/w3\.org\/2000\/svg|w3\.org\/1999\/xlink/i.test(u));
  if (external.length) errors.push(`${file}: external URL(s): ${[...new Set(external)].join(', ')}`);

  // Informational, not a violation: until 2026-09-20 the shell's `.slide svg text`
  // rule silently overrode fill="", so these colours never rendered. The rule is now
  // scoped and they do. Listing them means someone can confirm the colour that now
  // appears is the colour the author meant.
  const fills = raw.match(/<text\b[^>]*\bfill\s*=\s*"[^"]*"/gi) || [];
  if (fills.length) {
    const seen = [...new Set(fills.map((f) => (f.match(/fill\s*=\s*"([^"]*)"/i) || [])[1]))];
    svgFills.push(`${file}: ${fills.length} <text fill=...> (${seen.join(', ')})`);
  }

  const sections = splitSections(raw);
  if (!sections.length) {
    errors.push(`${file}: no <section> block found.`);
    continue;
  }

  // Anything outside the sections is silently dropped by the splice, so say so.
  const stray = visibleWords(raw.replace(/<section\b[\s\S]*?<\/section>/gi, ' '));
  if (stray.length) warnings.push(`${file}: ${stray.length} word(s) of text outside any <section> will be dropped.`);

  for (const [i, sec] of sections.entries()) {
    const title = attr(sec, 'data-title');
    const notes = attr(sec, 'data-notes');
    const label = sections.length > 1 ? `${file}#${i + 1}` : file;

    if (!title) errors.push(`${label}: <section> has no data-title.`);
    else if (titles.has(title)) errors.push(`${label}: duplicate data-title "${title}" (already used by ${titles.get(title)}).`);
    else titles.set(title, label);

    if (!notes) warnings.push(`${label}: <section> has no data-notes.`);
    if (!/\bclass\s*=\s*"[^"]*\bslide\b/i.test(sec)) errors.push(`${label}: <section> is missing class="slide".`);

    const words = visibleWords(sec);
    if (words.length > MAX_WORDS) {
      errors.push(`${label}: ${words.length} visible words, max ${MAX_WORDS}. Over by ${words.length - MAX_WORDS}: "${words.join(' ').slice(0, 120)}..."`);
    }

    slides.push({ file: label, html: sec.trim(), title: title || '(untitled)', words: words.length, prefix });
  }
}

// --- running-order completeness: placeholders for anything not delivered
const assembled = [];
const byPrefix = new Map();
for (const s of slides) {
  if (!s.prefix) continue;
  if (!byPrefix.has(s.prefix)) byPrefix.set(s.prefix, []);
  byPrefix.get(s.prefix).push(s);
}
const missing = [];
for (const [prefix, name] of RUNNING_ORDER) {
  if (byPrefix.has(prefix)) {
    for (const s of byPrefix.get(prefix)) assembled.push(s);
  } else {
    missing.push(`${prefix}-${name}`);
    const html = placeholder(prefix, name);
    assembled.push({ file: `(placeholder) ${prefix}-${name}.html`, html, title: `MISSING ${prefix}-${name}`, words: visibleWords(html).length, prefix, missing: true });
  }
}
// Anything numbered outside the running order (backup slides, e.g. 09-, 90-) goes last, in order.
for (const [prefix, list] of [...byPrefix.entries()].sort()) {
  if (RUNNING_ORDER.some(([p]) => p === prefix)) continue;
  for (const s of list) assembled.push(s);
}
// Unnumbered files, if any.
for (const s of slides) if (!s.prefix) assembled.push(s);

// ---------------------------------------------------------------- report

const W = (n) => String(n).padStart(2, ' ');
console.log('');
console.log('  Wattson deck assembly');
console.log('  ' + '-'.repeat(68));
for (const [i, s] of assembled.entries()) {
  const flag = s.missing ? ' MISSING' : s.words > MAX_WORDS ? ' OVER' : '';
  console.log(`  ${W(i + 1)}. ${String(s.words).padStart(2)}w  ${s.title.padEnd(34).slice(0, 34)}  ${s.file}${flag}`);
}
console.log('  ' + '-'.repeat(68));
const totalWords = assembled.reduce((a, s) => a + s.words, 0);
console.log(`  ${assembled.length} slides, ${totalWords} visible words, ${(totalWords / (assembled.length || 1)).toFixed(1)} per slide.`);
if (missing.length) console.log(`  MISSING FRAGMENTS (${missing.length}): ${missing.join(', ')}`);

if (svgFills.length) {
  console.log('');
  console.log('  SVG text colours (honoured since the shell fix — confirm each renders as intended):');
  for (const f of svgFills) console.log(`   . ${f}`);
}

if (warnings.length) {
  console.log('');
  console.log('  Warnings:');
  for (const w of warnings) console.log(`   - ${w}`);
}

if (errors.length) {
  console.log('');
  console.log(`  CONTRACT VIOLATIONS (${errors.length}):`);
  for (const e of errors) console.log(`   ! ${e}`);
  console.log('');
  console.log('  deck.html NOT written.');
  process.exit(1);
}

// ---------------------------------------------------------------- splice

if (check) {
  console.log('');
  console.log('  --check: contract clean, nothing written.');
  process.exit(0);
}

const shell = readFileSync(DECK, 'utf8');
const a = shell.indexOf(BEGIN);
const b = shell.indexOf(END);
if (a === -1 || b === -1 || b < a) {
  console.error(`\n  FATAL: ${basename(DECK)} is missing the ${BEGIN} / ${END} markers.`);
  process.exit(1);
}

const body = assembled
  .map((s) => `<!-- ${s.file} -->\n${s.html}`)
  .join('\n\n')
  .replace(/^/gm, '  ');

const out = shell.slice(0, a + BEGIN.length) + '\n' + body + '\n  ' + shell.slice(b);
writeFileSync(DECK, out, 'utf8');

// self-check: nothing external got in
const bad = (out.match(/\b(?:src|href)\s*=\s*"(?:https?:)?\/\/[^"]*"/gi) || []);
if (bad.length) {
  console.log('');
  console.log(`  ! deck.html now references something external: ${bad.join(', ')}`);
  process.exit(1);
}

console.log('');
console.log(`  Wrote ${DECK} (${(out.length / 1024).toFixed(1)} KB, self-contained, no external references).`);
console.log('');
