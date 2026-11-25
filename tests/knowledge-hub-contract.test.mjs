import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
// Load like the sitemap: the content module is dependency-free ES module source.
const lexicon = await import('data:text/javascript,' + encodeURIComponent(readFileSync(resolve(root, 'src/content/sosLexicon.js'), 'utf8')));
const sitemapSource = readFileSync(resolve(root, 'src/app/sitemap.js'), 'utf8');
const { default: sitemap, WIKI_SLUGS } = await import('data:text/javascript,' + encodeURIComponent(sitemapSource));
const superherosPage = readFileSync(resolve(root, 'src/app/superheros/page.jsx'), 'utf8');

const OFFICIAL = 'SUPERHEROS are S.O.S. roadside assistance providers who help motorists with vehicle-related difficulties, including towing, jump-starts, tire changes, fuel delivery, and vehicle lockout services.';

const allText = () => JSON.stringify({ a: lexicon.ARTICLES, t: lexicon.TERM, l: lexicon.LEXICON, g: lexicon.GLOSSARY, s: lexicon.CORE_SERVICES });

test('official definition is exact and drives the DefinedTerm markup', () => {
  assert.equal(lexicon.OFFICIAL_DEFINITION, OFFICIAL);
  assert.match(superherosPage, /description: OFFICIAL_DEFINITION/);
  assert.match(superherosPage, /'@type': 'DefinedTerm'/);
  assert.match(superherosPage, /SUPERHEROS Meaning & Definition \| S\.O\.S\. Roadside Assistance/);
});

test('sitemap lists every wiki article once and nothing else under /wiki', () => {
  assert.deepEqual([...WIKI_SLUGS].sort(), lexicon.ARTICLES.map((a) => a.slug).sort());
  const urls = sitemap().map((e) => e.url);
  assert.equal(urls.length, new Set(urls).size);
  for (const path of ['/', '/superheros/', '/wiki/', '/hero/apply/', '/wiki/superheros/']) assert.ok(urls.includes(`https://thesuperherosonstandby.com${path}`), path);
  assert.ok(!urls.some((u) => /\/(ops|auth|login)\//.test(u)));
});

test('five core services are covered with their own entries', () => {
  const slugs = lexicon.ARTICLES.map((a) => a.slug);
  assert.equal(lexicon.CORE_SERVICES.length, 5);
  for (const s of lexicon.CORE_SERVICES) assert.ok(slugs.includes(s.slug), s.slug);
});

test('articles are unique, cross-linked and resolve to real entries', () => {
  const slugs = new Set(lexicon.ARTICLES.map((a) => a.slug));
  const titles = new Set(lexicon.ARTICLES.map((a) => a.metaTitle));
  const descs = new Set(lexicon.ARTICLES.map((a) => a.description));
  assert.equal(titles.size, lexicon.ARTICLES.length);
  assert.equal(descs.size, lexicon.ARTICLES.length);
  for (const a of lexicon.ARTICLES) {
    assert.ok(a.related.length >= 2, `${a.slug} needs related links`);
    for (const r of a.related) assert.ok(slugs.has(r), `${a.slug} -> ${r}`);
    for (const p of a.sections.flatMap((s) => s.body)) {
      for (const [, href] of p.matchAll(/\]\((\/[^)]*)\)/g)) {
        const m = href.match(/^\/wiki\/([^/]+)\/$/);
        if (m) assert.ok(slugs.has(m[1]), `${a.slug} links to missing ${href}`);
        assert.ok(href.endsWith('/'), `${a.slug} link ${href} must use the trailing slash`);
      }
    }
    for (const s of a.sources) assert.match(s.url, /^https:\/\//);
  }
});

test('content makes no prohibited claims', () => {
  const text = allText();
  assert.doesNotMatch(text, /\$\s?\d/, 'no prices');
  assert.doesNotMatch(text, /\b\d+\s?(–|-|to)\s?\d+\s?min/i, 'no response-time promises');
  assert.doesNotMatch(text, /guarantee(d)? (response|arrival|coverage)|24\/7|within \d+ minutes/i);
  assert.doesNotMatch(text, /®/, 'no registered-mark symbol without registration');
  assert.doesNotMatch(text, /official wikipedia|wikipedia (approved|article)|recogni[sz]ed by (merriam|oxford|wiktionary)/i);
});

test('every hub page carries the brand-material disclosure', () => {
  assert.match(lexicon.DISCLOSURE, /not Wikipedia/);
  assert.match(lexicon.DISCLOSURE, /not affiliated with the Wikimedia Foundation/);
  for (const f of ['src/app/wiki/page.jsx', 'src/app/wiki/[slug]/page.jsx', 'src/app/superheros/page.jsx']) {
    assert.match(readFileSync(resolve(root, f), 'utf8'), /DISCLOSURE/, f);
  }
});

test('GDOT HERO disambiguation is present', () => {
  assert.match(allText(), /not affiliated with GDOT/);
});
