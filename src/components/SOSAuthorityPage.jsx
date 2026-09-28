const ORG = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://thesuperherosonstandby.com/#organization',
  name: 'Superheros On Standby',
  alternateName: ['S.O.S.', 'SOS', 'SUPERHEROS'],
  url: 'https://thesuperherosonstandby.com',
  logo: 'https://thesuperherosonstandby.com/brand/sos-logo.webp',
  sameAs: ['https://www.instagram.com/superhero.onstandby/'],
  description: 'Superheros On Standby is a roadside mobility and assistance network. SUPERHEROS is the company’s intentionally spelled brand term for real people who show up when help is needed.'
};

export default function SOSAuthorityPage({ kicker, title, lede, children, pagePath='/superheros', pageDescription }) {
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `https://thesuperherosonstandby.com${pagePath}/#webpage`,
    url: `https://thesuperherosonstandby.com${pagePath}/`,
    name: title,
    description: pageDescription || lede,
    isPartOf: { '@id': 'https://thesuperherosonstandby.com/#website' },
    about: { '@id': 'https://thesuperherosonstandby.com/#organization' }
  };

  return <main className="sos-authority">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(ORG)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(webPage)}} />
    <nav className="sos-authority-nav" aria-label="S.O.S. authority navigation">
      <a className="sos-authority-brand" href="/superheros/">
        <img src="/brand/sos-logo.webp" alt="S.O.S. logo" />
        <span><strong>S.O.S.</strong><small>Superheros On Standby</small></span>
      </a>
      <div className="sos-authority-links">
        <a href="/why-superheros/">Why SUPERHEROS</a>
        <a href="/superheros-network/">Network</a>
        <a href="/history/">History</a>
        <a href="/brand/">Brand</a>
        <a href="/press/">Press</a>
        <a href="/media-kit/">Media Kit</a>
      </div>
    </nav>
    <header className="sos-authority-hero">
      <div className="sos-authority-kicker">{kicker}</div>
      <h1>{title}</h1>
      <p className="lede">{lede}</p>
    </header>
    {children}
    <footer className="sos-authority-footer">© {new Date().getFullYear()} S.O.S. — Superheros On Standby. SUPERHEROS is an intentionally spelled brand term.</footer>
  </main>
}