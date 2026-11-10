'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf-8');
}

function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}

function localRefs(relative) {
  const html = read(relative);
  const refs = [];
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^(https?:|mailto:|data:|#)/.test(ref)) continue;
    refs.push(ref);
  }
  return refs;
}

console.log('Pruefung 1: Eindeutiger Deployment-Pfad');
assert.equal(exists('wrangler.toml'), false, 'wrangler.toml darf nicht parallel zu Cloudflare Pages existieren');
assert.equal(exists('public/index.html'), false, 'public/ enthaelt keine zweite, abweichende Startseite');
assert.equal(exists('index.html'), true, 'Startseite liegt genau einmal im Repo-Root');
console.log('  Genau eine Startseite, genau ein Deployment-Weg (Cloudflare Pages, Root-Verzeichnis)');

console.log('Pruefung 2: Alle lokalen Verweise der Startseite loesen sich auf');
for (const ref of localRefs('index.html')) {
  const target = ref.replace(/^\//, '');
  assert.equal(exists(target), true, `index.html verweist auf fehlende Datei: ${ref}`);
}
console.log('  index.html: alle lokalen Verweise vorhanden');

console.log('Pruefung 3: Alle lokalen Verweise der App-Seiten loesen sich auf');
for (const page of ['public/app.html', 'public/testphase.html']) {
  for (const ref of localRefs(page)) {
    const target = path.join('public', ref).replace(/^\//, '');
    assert.equal(exists(target), true, `${page} verweist auf fehlende Datei: ${ref}`);
  }
}
console.log('  public/app.html und public/testphase.html: alle lokalen Verweise vorhanden');

console.log('Pruefung 4: Rechtliche Pflichtseiten und Domain');
assert.equal(exists('datenschutz.html'), true);
assert.equal(exists('impressum.html'), true);
assert.equal(read('CNAME').trim(), 'entrotopia.de');
console.log('  datenschutz.html, impressum.html, CNAME vorhanden');

console.log('Pruefung 5: Keine unersetzenen Platzhalter, noindex bleibt aktiv');
for (const page of ['index.html', 'datenschutz.html', 'impressum.html']) {
  assert.ok(!/\{\{/.test(read(page)), `${page} enthaelt unersetzte Platzhalter`);
}
assert.ok(/noindex,nofollow/.test(read('index.html')), 'Startseite muss noindex,nofollow bleiben');
console.log('  Keine Platzhalter, noindex aktiv');

console.log('site build tests: ok');
