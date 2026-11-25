export const dynamic = 'force-static';

// Standalone on purpose (tests import this file directly, without the app's
// module aliases). Only self-canonical, publicly indexable routes belong here.
// WIKI_SLUGS must match ARTICLES in src/content/sosLexicon.js
// (enforced by tests/knowledge-hub-contract.test.mjs).
export const WIKI_SLUGS = [
  'superheros',
  'roadside-assistance',
  'towing',
  'jump-start',
  'tire-change',
  'fuel-delivery',
  'lockout-service',
  'how-sos-works',
  'provider-network',
  'provider-categories',
  'safety-standards',
  'roadside-terminology',
];

const KNOWLEDGE_HUB_UPDATED = '2026-11-11';

export default function sitemap(){
  const base='https://thesuperherosonstandby.com';
  const entries=[
    ['/', 'weekly', 1],
    ['/superheros/', 'monthly', .95],
    ['/hero/apply/', 'weekly', .9],
    ['/wiki/', 'weekly', .85],
    ...WIKI_SLUGS.map((slug)=>[`/wiki/${slug}/`, 'monthly', slug==='superheros'?.85:.7]),
    ['/why-superheros/', 'monthly', .75],
    ['/about-superheros-on-standby/', 'monthly', .75],
    ['/superheros-network/', 'monthly', .75],
    ['/history/', 'monthly', .6],
    ['/brand/', 'monthly', .6],
    ['/press/', 'monthly', .6],
    ['/media-kit/', 'monthly', .6],
    ['/legal/', 'yearly', .4],
    ['/support/', 'monthly', .4],
    ['/privacy/', 'yearly', .3],
    ['/terms/', 'yearly', .3],
  ];
  return entries.map(([path, changeFrequency, priority])=>({
    url:base+path,
    changeFrequency,
    priority,
    ...(path==='/superheros/'||path.startsWith('/wiki/')?{lastModified:KNOWLEDGE_HUB_UPDATED}:{}),
  }));
}
