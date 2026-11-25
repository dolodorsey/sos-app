import { CUSTOMER_CTA, PROVIDER_CTA, SITE } from '@/content/sosLexicon';

const ORG = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'Superheros On Standby',
  alternateName: ['S.O.S.', 'SOS', 'S.O.S. — Superheros On Standby'],
  url: SITE,
  logo: `${SITE}/brand/sos-logo.webp`,
  sameAs: ['https://www.instagram.com/superhero.onstandby/'],
  areaServed: { '@type': 'City', name: 'Atlanta', containedInPlace: { '@type': 'State', name: 'Georgia' } },
  description: 'Superheros On Standby (S.O.S.) is a roadside assistance platform in metro Atlanta. Its roadside assistance providers are called SUPERHEROS.',
};

const WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  url: `${SITE}/`,
  name: 'S.O.S. — Superheros On Standby',
  alternateName: ['Superheros On Standby', 'S.O.S.', 'SOS'],
  publisher: { '@id': `${SITE}/#organization` },
  inLanguage: 'en-US',
};

const ld = (data) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;

export function breadcrumbLd(crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE}${c.href}` })),
  };
}

export default function SOSAuthorityPage({ kicker, title, lede, children, pagePath = '/superheros', pageDescription, breadcrumbs, jsonLd = [], webPageType = 'WebPage', titleClassName }) {
  const path = pagePath.endsWith('/') ? pagePath : `${pagePath}/`;
  const webPage = {
    '@context': 'https://schema.org',
    '@type': webPageType,
    '@id': `${SITE}${path}#webpage`,
    url: `${SITE}${path}`,
    name: typeof title === 'string' ? title : undefined,
    description: pageDescription || lede,
    isPartOf: { '@id': `${SITE}/#website` },
    about: { '@id': `${SITE}/#organization` },
    publisher: { '@id': `${SITE}/#organization` },
    inLanguage: 'en-US',
  };

  return <main className="sos-authority">
    {ld(ORG)}
    {ld(WEBSITE)}
    {ld(webPage)}
    {breadcrumbs && ld(breadcrumbLd(breadcrumbs))}
    {jsonLd.map((data, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />)}
    <nav className="sos-authority-nav" aria-label="S.O.S. authority navigation">
      <a className="sos-authority-brand" href="/superheros/">
        <img src="/brand/sos-logo.webp" alt="S.O.S. logo" />
        <span><strong>S.O.S.</strong><small>Superheros On Standby</small></span>
      </a>
      <div className="sos-authority-links">
        <a href="/superheros/">SUPERHEROS</a>
        <a href="/wiki/">Knowledge Hub</a>
        <a href="/why-superheros/">Why SUPERHEROS</a>
        <a href="/superheros-network/">Network</a>
        <a href="/press/">Press</a>
        <a href={CUSTOMER_CTA.href} className="sos-authority-navcta" data-khg-event="booking_interest" data-khg-cta="authority-nav-request">Get help</a>
      </div>
    </nav>
    {breadcrumbs && <ol className="sos-authority-crumbs" aria-label="Breadcrumb">
      {breadcrumbs.map((c, i) => <li key={c.href}>{i < breadcrumbs.length - 1 ? <a href={c.href}>{c.name}</a> : <span aria-current="page">{c.name}</span>}</li>)}
    </ol>}
    <header className="sos-authority-hero">
      <div className="sos-authority-kicker">{kicker}</div>
      <h1 className={titleClassName}>{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </header>
    {children}
    <footer className="sos-authority-footer">
      <div className="sos-authority-footer-cols">
        <div><strong>Drivers</strong><a href={CUSTOMER_CTA.href} data-khg-event="booking_interest" data-khg-cta="authority-footer-request">Request roadside help</a><a href="/track/">Track a mission</a><a href="/legal/">S.O.S. is not 911</a></div>
        <div><strong>Providers</strong><a href={PROVIDER_CTA.href} data-khg-event="application" data-khg-cta="authority-footer-apply">Become a SUPERHERO</a><a href="/hero/">SUPERHERO portal</a><a href="/wiki/provider-network/">Provider network</a></div>
        <div><strong>Knowledge Hub</strong><a href="/superheros/">What SUPERHEROS means</a><a href="/wiki/">S.O.S. Knowledge Hub</a><a href="/wiki/roadside-terminology/">Roadside terminology</a></div>
        <div><strong>Company</strong><a href="/about-superheros-on-standby/">About S.O.S.</a><a href="/brand/">Brand guide</a><a href="/press/">Press</a><a href="/privacy/">Privacy</a></div>
      </div>
      <p>© {new Date().getFullYear()} S.O.S. — Superheros On Standby, a brand of The Kollective Hospitality Group. SUPERHEROS is an intentionally spelled S.O.S. brand term.</p>
    </footer>
  </main>;
}
