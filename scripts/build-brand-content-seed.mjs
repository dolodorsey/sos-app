#!/usr/bin/env node
// Builds an idempotent upsert for public.sos_brand_content from src/content/sosLexicon.js,
// so the database mirrors exactly what the website publishes.
//
// Usage: node scripts/build-brand-content-seed.mjs > /tmp/seed.sql
// Approval fields are only set where a human decision exists (see APPROVALS).

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'src/content/sosLexicon.js'), 'utf8');
const L = await import('data:text/javascript,' + encodeURIComponent(src));

const HANDOFF = 'founder handoff 2026-11-11 (SUPERHEROS Brand Authority P0)';
const slug = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const rows = [];
rows.push({ content_key: 'definition:superheros', kind: 'definition', title: 'SUPERHEROS — official definition', canonical_url: `${L.SITE}/superheros/`, status: 'approved', approved_by: HANDOFF,
  body: { text: L.OFFICIAL_DEFINITION, singular: L.TERM.singular, plural: L.TERM.plural, part_of_speech: L.TERM.partOfSpeech, pronunciation: L.TERM.pronunciation, ipa: L.TERM.ipa, origin: L.TERM.origin, usage_examples: L.TERM.usage, usage_notes: L.TERM.usageNotes, core_services: L.CORE_SERVICES } });
for (const t of L.TAGLINES) rows.push({ content_key: `tagline:${slug(t)}`, kind: 'tagline', title: t, canonical_url: null, status: 'approved', approved_by: HANDOFF, body: { text: t, use: 'campaign title / social line' } });
rows.push({ content_key: 'boilerplate:disclosure', kind: 'boilerplate', title: 'Knowledge Hub disclosure', canonical_url: `${L.SITE}/wiki/`, status: 'in_review', approved_by: null, body: { text: L.DISCLOSURE } });
for (const a of L.ARTICLES) rows.push({ content_key: `wiki:${a.slug}`, kind: 'wiki_article', title: a.title, canonical_url: `${L.SITE}/wiki/${a.slug}/`, status: 'in_review', approved_by: null,
  body: { meta_title: a.metaTitle, description: a.description, summary: a.summary, category: a.category, lead: a.lead, sections: a.sections, faq: a.faq || [], related: a.related, sources: a.sources, published: L.PUBLISHED, updated: L.UPDATED } });
rows.push({ content_key: 'wiki:index', kind: 'wiki_article', title: 'S.O.S. Knowledge Hub', canonical_url: `${L.SITE}/wiki/`, status: 'in_review', approved_by: null, body: { lexicon: L.LEXICON, glossary: L.GLOSSARY } });

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `$json$${JSON.stringify(v)}$json$::jsonb`;
const values = rows.map((r) => `(${q(r.content_key)}, ${q(r.kind)}, ${q(r.title)}, ${j(r.body)}, ${q(r.canonical_url)}, ${q(r.status)}, ${q(r.approved_by)}, ${r.approved_by ? 'now()' : 'null'}, 'src/content/sosLexicon.js', 'claude')`).join(',\n');

process.stdout.write(`insert into public.sos_brand_content (content_key, kind, title, body, canonical_url, status, approved_by, approved_at, source_repo_path, updated_by) values
${values}
on conflict (content_key) do update set title = excluded.title, body = excluded.body, canonical_url = excluded.canonical_url, source_repo_path = excluded.source_repo_path, updated_by = excluded.updated_by;
`);
