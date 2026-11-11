import SOSAuthorityPage from '@/components/SOSAuthorityPage';
import { CORE_SERVICES, CUSTOMER_CTA, DISCLOSURE, OFFICIAL_DEFINITION, PROVIDER_CTA, SITE, TERM, UPDATED } from '@/content/sosLexicon';

const TITLE = 'SUPERHEROS Meaning & Definition | S.O.S. Roadside Assistance';
const DESCRIPTION = 'Discover what SUPERHEROS means, why S.O.S. uses the word, and how roadside assistance providers help drivers with towing, tires, batteries, fuel and lockouts.';
const URL = `${SITE}/superheros/`;

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/superheros/' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: 'article', siteName: 'S.O.S. — Superheros On Standby', images: [{ url: '/sos-app-icon-512.png', width: 512, height: 512, alt: 'S.O.S. logo' }] },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

const DEFINED_TERM = {
  '@context': 'https://schema.org',
  '@type': 'DefinedTerm',
  '@id': `${URL}#term`,
  name: 'SUPERHEROS',
  alternateName: 'SUPERHERO',
  description: OFFICIAL_DEFINITION,
  url: URL,
  inDefinedTermSet: { '@type': 'DefinedTermSet', '@id': `${SITE}/wiki/#lexicon`, name: 'S.O.S. Lexicon', url: `${SITE}/wiki/` },
};

const CRUMBS = [{ name: 'S.O.S.', href: '/about-superheros-on-standby/' }, { name: 'Knowledge Hub', href: '/wiki/' }, { name: 'SUPERHEROS', href: '/superheros/' }];

export default function Page() {
  return <SOSAuthorityPage kicker="Official S.O.S. definition" title="SUPERHEROS" titleClassName="sos-dict-word" lede={null} pagePath="/superheros" pageDescription={DESCRIPTION} breadcrumbs={CRUMBS} jsonLd={[DEFINED_TERM]}>
    <article className="sos-dict" aria-labelledby="sos-dict-def">
      <section className="sos-dict-entry">
        <p className="sos-dict-head">
          <span className="sos-dict-pron" aria-label={`Pronunciation: ${TERM.pronunciation}`}>{TERM.ipa} · {TERM.pronunciation}</span>
          <span className="sos-dict-pos">{TERM.partOfSpeech}</span>
        </p>
        <dl className="sos-dict-forms">
          <div><dt>Singular</dt><dd>{TERM.singular}</dd></div>
          <div><dt>Plural</dt><dd>{TERM.plural}</dd></div>
        </dl>
        <h2 id="sos-dict-def" className="sos-visually-label">Definition</h2>
        <p className="sos-dict-def"><span aria-hidden="true">1.</span> {OFFICIAL_DEFINITION}</p>
        <div className="sos-dict-ctas">
          <a className="sos-authority-cta" href={CUSTOMER_CTA.href} data-khg-event="booking_interest" data-khg-cta="superheros-definition-request">{CUSTOMER_CTA.label}</a>
          <a className="sos-authority-cta ghost" href={PROVIDER_CTA.href} data-khg-event="application" data-khg-cta="superheros-definition-apply">{PROVIDER_CTA.label}</a>
        </div>
      </section>

      <section className="sos-authority-grid">
        <div className="sos-authority-card wide">
          <h2>Word origin</h2>
          <p>{TERM.origin} <a href="/why-superheros/">Read the naming story</a>.</p>
        </div>

        <div className="sos-authority-card wide">
          <h2>The five core services</h2>
          <ul className="sos-dict-services">
            {CORE_SERVICES.map((s) => <li key={s.slug}><a href={`/wiki/${s.slug}/`}><strong>{s.name}</strong><span>{s.short}</span></a></li>)}
          </ul>
          <p className="sos-dict-note">Available through the S.O.S. app in metro Atlanta.</p>
        </div>

        <div className="sos-authority-card">
          <h2>Using the word</h2>
          <ul className="sos-authority-list sos-dict-examples">
            {TERM.usage.map((u) => <li key={u}><q>{u}</q></li>)}
          </ul>
        </div>

        <div className="sos-authority-card">
          <h2>Usage notes</h2>
          <ul className="sos-authority-list">
            {TERM.usageNotes.map((u) => <li key={u}>{u}</li>)}
          </ul>
        </div>

        <div className="sos-authority-card">
          <h3>Need roadside help?</h3>
          <p>Request a SUPERHERO in the S.O.S. app. Your request is offered to qualified providers nearby and is assigned when one accepts. S.O.S. is not 911 — if anyone is hurt or in danger, call 911 first.</p>
          <a className="sos-authority-cta" href={CUSTOMER_CTA.href} data-khg-event="booking_interest" data-khg-cta="superheros-card-request">{CUSTOMER_CTA.label}</a>
        </div>

        <div className="sos-authority-card">
          <h3>Become a SUPERHERO</h3>
          <p>Tow operators, mobile roadside technicians and lockout specialists in metro Atlanta can apply to join the network. Verification is required before accepting customer missions.</p>
          <a className="sos-authority-cta" href={PROVIDER_CTA.href} data-khg-event="application" data-khg-cta="superheros-card-apply">Apply to join</a>
        </div>

        <div className="sos-authority-card wide">
          <h2>Keep reading</h2>
          <ul className="sos-dict-related">
            <li><a href="/wiki/superheros/">SUPERHEROS — Knowledge Hub entry</a></li>
            <li><a href="/wiki/how-sos-works/">How S.O.S. works</a></li>
            <li><a href="/wiki/provider-network/">The SUPERHEROS provider network</a></li>
            <li><a href="/wiki/safety-standards/">Safety standards</a></li>
            <li><a href="/wiki/roadside-terminology/">Roadside terminology</a></li>
            <li><a href="/wiki/">All Knowledge Hub entries</a></li>
          </ul>
        </div>
      </section>
      <p className="sos-wiki-disclosure">{DISCLOSURE} Last updated <time dateTime={UPDATED}>November 11, 2026</time>.</p>
    </article>
  </SOSAuthorityPage>;
}
