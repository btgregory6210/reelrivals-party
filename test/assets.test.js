import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VEHICLES } from '../src/vehicles.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('all 10 icon pictures exist', () => {
  assert.equal(VEHICLES.length, 10);
  for (const [id] of VEHICLES) {
    assert.ok(fs.existsSync(new URL(`../public/vehicles/${id}.png`, import.meta.url)), `missing ${id}.png`);
  }
});

test('the phone page lists the same trophies, in the same order, as the service', () => {
  const block = html.match(/const VEHICLES = \[([\s\S]*?)\];/)[1];
  const page = [...block.matchAll(/\['([a-z]+)',\s*(?:'([^']*)'|"([^"]*)")\]/g)].map((m) => [m[1], m[2] ?? m[3]]);
  assert.deepEqual(page, VEHICLES);
});

test('the wordmark is there for the phone page header', () => {
  assert.ok(fs.existsSync(new URL('../public/wordmark.png', import.meta.url)));
});

// These come from the website chat's folder (Documents/ReelRivals/website) and must
// keep working: Apple needs /support and /privacy, AdMob needs /app-ads.txt, and the
// iPhone app's friend challenges open /join/CODE.
test('website pages Apple, AdMob and the iPhone app rely on are present', () => {
  for (const f of ['support.html', 'privacy.html', 'join.html', 'logo.png', 'app-ads.txt', '_redirects']) {
    assert.ok(fs.existsSync(new URL(`../public/${f}`, import.meta.url)), `missing public/${f}`);
  }
  const redirects = fs.readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
  assert.match(redirects, /^\/join\/\* \/join\.html 200$/m);
  assert.match(fs.readFileSync(new URL('../public/app-ads.txt', import.meta.url), 'utf8'), /pub-\d+/);
});
