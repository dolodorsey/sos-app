'use client';

import { useMemo, useState } from 'react';

// Knowledge Hub directory. The full list is prerendered into the static HTML
// (crawlable without JavaScript); typing only filters what is already there.
export default function SOSWikiSearch({ entries }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => entries.filter((e) => !q || `${e.title} ${e.summary} ${e.category}`.toLowerCase().includes(q)), [entries, q]);
  const categories = [...new Set(entries.map((e) => e.category))];

  return <section className="sos-wiki-directory" aria-labelledby="sos-wiki-directory-title">
    <div className="sos-wiki-searchbar">
      <label htmlFor="sos-wiki-q" id="sos-wiki-directory-title">Search the S.O.S. Knowledge Hub</label>
      <input id="sos-wiki-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try towing, lockout, SUPERHERO…" autoComplete="off" />
      <p className="sos-wiki-count" aria-live="polite">{visible.length} of {entries.length} entries</p>
    </div>
    {categories.map((cat) => {
      const items = visible.filter((e) => e.category === cat);
      if (!items.length) return null;
      return <div key={cat} className="sos-wiki-group">
        <h2>{cat}</h2>
        <ul>
          {items.map((e) => <li key={e.slug}><a href={`/wiki/${e.slug}/`}><strong>{e.title}</strong><span>{e.summary}</span></a></li>)}
        </ul>
      </div>;
    })}
    {!visible.length && <p className="sos-wiki-empty">No entries match “{query}”. <a href="/wiki/roadside-terminology/">Browse the glossary</a>.</p>}
  </section>;
}
