// Web front door. The packaged app is sent to /app/ by the root layout before
// paint, so native users keep the full customer entry point at /app.
// Website visitors (thesuperherosonstandby.com, and superherosonstandby.com,
// which forwards here) first see the services-at-launch intro, then the homepage.
import SOSHome from '@/components/SOSHome';
import SOSHeroIntro from '@/components/SOSHeroIntro';

export default function HomePage() {
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
      <SOSHome />
    </>
  );
}
