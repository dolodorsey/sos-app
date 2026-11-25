import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sitemapSource = readFileSync(resolve(root, 'src/app/sitemap.js'), 'utf8');
const layoutSource = readFileSync(resolve(root, 'src/app/hero/apply/layout.jsx'), 'utf8');
const nextConfig = readFileSync(resolve(root, 'next.config.js'), 'utf8');

// Evaluate only the standalone sitemap module, without booting the app or contacting a provider.
const { default: sitemap } = await import('data:text/javascript,' + encodeURIComponent(sitemapSource));

test('Hero application is present once in the public sitemap', () => {
  const urls = sitemap().map(entry => entry.url);
  const apply = urls.filter(url => url === 'https://thesuperherosonstandby.com/hero/apply/');
  assert.equal(apply.length, 1);
  assert.equal(urls.length, new Set(urls).size);
});

test('Hero page declares unique metadata, self canonical, and specific social URL', () => {
  assert.match(layoutSource, /Become a Hero \| S\.O\.S\./);
  assert.match(layoutSource, /canonical: '\/hero\/apply\/'/);
  assert.match(layoutSource, /url: 'https:\/\/thesuperherosonstandby\.com\/hero\/apply\/'/);
  assert.match(layoutSource, /does not guarantee approval, activation, or jobs/);
  assert.match(nextConfig, /trailingSlash:\s*true/);
});
