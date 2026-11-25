'use client';

// The packaged app starts at /. Keep it on the same complete customer
// experience as /app so release safeguards and features cannot drift.
// Website visitors (thesuperherosonstandby.com, and superherosonstandby.com,
// which forwards here) first see the services-at-launch intro.
import CustomerApp from './app/page';
import SOSHeroIntro from '../components/SOSHeroIntro';

export default function Home() {
  return (
    <>
      <SOSHeroIntro
        src="/brand/intro/sos-services-intro.mp4"
        poster="/brand/intro/sos-services-intro-poster.jpg"
        seenKey="sos_services_intro_seen_at"
        aspect={832 / 1040}
        hasSound={false}
        label="S.O.S. services at launch intro"
        webOnly
      />
      <CustomerApp />
    </>
  );
}
