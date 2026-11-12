import { notFound } from 'next/navigation';
import SOSAuthorityPage from '@/components/SOSAuthorityPage';
import SOSRichText, { plainText } from '@/components/SOSRichText';
import { ARTICLES, CUSTOMER_CTA, DISCLOSURE, GLOSSARY, PROVIDER_CTA, PUBLISHED, SITE, UPDATED, articleBySlug } from '@/content/sosLexicon';

export const dynamicParams = false;
export function generateStaticParams() { return ARTICLES.map((a) => ({ slug: a.slug })); }

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) return {};
  const url = `${SITE}/wiki/${a.slug}/`;
  return {
    title: a.metaTitle,
    description: a.description,
    alternates: { canonical: `/wiki/${a.slug}/` },
    openGraph: { title: a.metaTitle, description: a.description, url, type: 'article', siteName: 'S.O.S. — Superheros On Standby', publishedTime: PUBLISHED, modifiedTime: UPDATED, images: [{ url: '/sos-app-icon-512.png', width: 512, height: 512, alt: 'S.O.S. logo' }] },
    twitter: { card: 'summary', title: a.metaTitle, description: a.description },
  };
}

const DATE_LABEL = 'November 11, 2026';

export default async function Page({ params }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) notFound();
  const url = `${SITE}/wiki/${a.slug}/`;
  const related = a.related.map(articleBySlug).filter(Boolean);
  const isProviderTopic = a.category === 'Providers';

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: a.metaTitle.replace(/ — S\.O\.S\. Knowledge Hub.*$/, ''),
    description: a.description,
    datePublished: PUBLISHED,
    dateModified: UPDATED,
    inLanguage: 'en-US',
    image: `${SITE}/sos-app-icon-512.png`,
    mainEntityOfPage: url,
    author: { '@id': `${SITE}/#organization` },
    publisher: { '@id': `${SITE}/#organization` },
    isPartOf: { '@id': `${SITE}/wiki/#webpage` },
    ...(a.slug === 'superheros' ? { about: { '@id': `${SITE}/superheros/#term` } } : {}),
    ...(a.sources.length ? { citation: a.sources.filter((s) => !s.owned).map((s) => ({ '@type': 'CreativeWork', name: s.label, url: s.url })) } : {}),
  };
  const ld = [articleLd];
  if (a.faq) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: a.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  if (a.glossary) ld.push({ '@context': 'https://schema.org', '@type': 'DefinedTermSet', '@id': `${url}#glossary`, name: 'S.O.S. roadside terminology', url, hasDefinedTerm: GLOSSARY.map((t) => ({ '@type': 'DefinedTerm', name: t.name, description: t.description, url: `${SITE}${t.url}` })) });

  const toc = [...a.sections.map((s) => ({ id: s.id, heading: s.heading })), ...(a.faq ? [{ id: 'faq', heading: 'Frequently asked questions' }] : []), ...(a.sources.length ? [{ id: 'sources', heading: 'Sources' }] : [])];

  return <SOSAuthorityPage
    kicker={`S.O.S. Knowledge Hub · ${a.category}`}
    title={a.title}
    lede={plainText(a.lead)}
    pagePath={`/wiki/${a.slug}`}
    pageDescription={a.description}
    breadcrumbs={[{ name: 'S.O.S.', href: '/about-superheros-on-standby/' }, { name: 'Knowledge Hub', href: '/wiki/' }, { name: a.title, href: `/wiki/${a.slug}/` }]}
    jsonLd={ld}
    titleClassName={a.title.length > 14 ? 'sos-wiki-title-long' : undefined}
  >
    <p className="sos-wiki-disclosure top" role="note">{DISCLOSURE}</p>
    <div className="sos-wiki-layout">
      <article className="sos-wiki-article">
        <p className="sos-wiki-meta">Published by S.O.S. — Superheros On Standby · Updated <time dateTime={UPDATED}>{DATE_LABEL}</time></p>
        {toc.length > 2 && <nav className="sos-wiki-toc" aria-label="Contents"><strong>Contents</strong><ol>{toc.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.heading}</a></li>)}</ol></nav>}
        {a.sections.map((s) => <section key={s.id} id={s.id}>
          <h2>{s.heading}</h2>
          {s.body.map((p, i) => <p key={i}><SOSRichText text={p} /></p>)}
        </section>)}
        {a.glossary && <section id="glossary"><h2>Glossary</h2><dl className="sos-wiki-lexicon">
          {GLOSSARY.map((t) => <div key={t.id} id={t.url.includes('#') ? t.url.split('#')[1] : t.id}><dt>{t.url.includes('#') ? t.name : <a href={t.url}>{t.name}</a>}</dt><dd>{t.description}</dd></div>)}
        </dl></section>}
        {a.faq && <section id="faq"><h2>Frequently asked questions</h2>
          {a.faq.map((f) => <details key={f.q} className="sos-wiki-faq"><summary>{f.q}</summary><p>{f.a}</p></details>)}
        </section>}
        {a.sources.length > 0 && <section id="sources"><h2>Sources</h2><ol className="sos-wiki-sources">
          {a.sources.map((s) => <li key={s.url}><a href={s.url} {...(s.owned ? {} : { rel: 'noopener', target: '_blank' })}>{s.label}</a>{s.owned ? ' — S.O.S.-published' : ` — ${s.publisher}`}</li>)}
        </ol></section>}
      </article>
      <aside className="sos-wiki-aside">
        <div className="sos-authority-card">
          <h3>{isProviderTopic ? 'Become a SUPERHERO' : 'Need roadside help?'}</h3>
          <p>{isProviderTopic ? 'Apply to join the S.O.S. network in metro Atlanta. Verification comes before customer missions.' : 'Request a SUPERHERO in the S.O.S. app in metro Atlanta. Not 911 — call 911 if anyone is hurt or in danger.'}</p>
          {isProviderTopic
            ? <a className="sos-authority-cta" href={PROVIDER_CTA.href} data-khg-event="application" data-khg-cta={`wiki-${a.slug}-apply`}>{PROVIDER_CTA.label}</a>
            : <a className="sos-authority-cta" href={CUSTOMER_CTA.href} data-khg-event="booking_interest" data-khg-cta={`wiki-${a.slug}-request`}>{CUSTOMER_CTA.label}</a>}
          <a className="sos-wiki-alt" href={isProviderTopic ? CUSTOMER_CTA.href : PROVIDER_CTA.href} data-khg-event={isProviderTopic ? 'booking_interest' : 'application'} data-khg-cta={`wiki-${a.slug}-alt`}>{isProviderTopic ? 'Need help instead? Request roadside help' : 'Provider? Join the SUPERHEROS network'}</a>
        </div>
        {related.length > 0 && <nav className="sos-authority-card" aria-label="Related entries"><h3>Related</h3><ul className="sos-wiki-related">
          <li><a href="/superheros/">SUPERHEROS — definition</a></li>
          {related.filter((r) => r.slug !== 'superheros').map((r) => <li key={r.slug}><a href={`/wiki/${r.slug}/`}>{r.title}</a></li>)}
          <li><a href="/wiki/">All entries</a></li>
        </ul></nav>}
      </aside>
    </div>
  </SOSAuthorityPage>;
}
