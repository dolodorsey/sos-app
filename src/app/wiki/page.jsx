import SOSAuthorityPage from '@/components/SOSAuthorityPage';
import SOSWikiSearch from '@/components/SOSWikiSearch';
import { ARTICLES, DISCLOSURE, LEXICON, SITE } from '@/content/sosLexicon';

const TITLE = 'S.O.S. Knowledge Hub | SUPERHEROS & Roadside Assistance';
const DESCRIPTION = 'The S.O.S. Knowledge Hub: what SUPERHEROS means, how S.O.S. roadside assistance works, the five core services, the provider network and roadside terminology.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/wiki/' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE}/wiki/`, type: 'website', siteName: 'S.O.S. — Superheros On Standby', images: [{ url: '/sos-app-icon-512.png', width: 512, height: 512, alt: 'S.O.S. logo' }] },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

const TERM_SET = {
  '@context': 'https://schema.org',
  '@type': 'DefinedTermSet',
  '@id': `${SITE}/wiki/#lexicon`,
  name: 'S.O.S. Lexicon',
  description: 'Terms defined by S.O.S. — Superheros On Standby for its roadside assistance platform.',
  url: `${SITE}/wiki/`,
  publisher: { '@id': `${SITE}/#organization` },
  hasDefinedTerm: LEXICON.map((t) => ({ '@type': 'DefinedTerm', name: t.name, description: t.description, url: `${SITE}${t.url}`, inDefinedTermSet: { '@id': `${SITE}/wiki/#lexicon` } })),
};

const ITEM_LIST = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'S.O.S. Knowledge Hub entries',
  itemListElement: ARTICLES.map((a, i) => ({ '@type': 'ListItem', position: i + 1, name: a.title, url: `${SITE}/wiki/${a.slug}/` })),
};

export default function Page() {
  const entries = ARTICLES.map(({ slug, title, summary, category }) => ({ slug, title, summary, category }));
  return <SOSAuthorityPage
    kicker="S.O.S. Knowledge Hub"
    title="KNOWLEDGE HUB"
    lede="Plain-language answers about SUPERHEROS, S.O.S. roadside assistance and the provider network, published by S.O.S."
    pagePath="/wiki"
    pageDescription={DESCRIPTION}
    webPageType="CollectionPage"
    breadcrumbs={[{ name: 'S.O.S.', href: '/about-superheros-on-standby/' }, { name: 'Knowledge Hub', href: '/wiki/' }]}
    jsonLd={[TERM_SET, ITEM_LIST]}
  >
    <p className="sos-wiki-disclosure top" role="note">{DISCLOSURE}</p>
    <section className="sos-authority-card wide sos-wiki-feature">
      <span className="sos-authority-pill">Start here</span>
      <h2><a href="/superheros/">What does SUPERHEROS mean?</a></h2>
      <p>{LEXICON[0].description}</p>
    </section>
    <SOSWikiSearch entries={entries} />
    <section className="sos-wiki-group" aria-labelledby="sos-lexicon-title">
      <h2 id="sos-lexicon-title">S.O.S. lexicon</h2>
      <dl className="sos-wiki-lexicon">
        {LEXICON.map((t) => <div key={t.id}><dt><a href={t.url}>{t.name}</a></dt><dd>{t.description}</dd></div>)}
      </dl>
    </section>
  </SOSAuthorityPage>;
}
