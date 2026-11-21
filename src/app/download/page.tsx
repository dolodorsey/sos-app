export const metadata = {
  title: 'S.O.S. — Launch status | Superheros On Standby',
  description: 'The S.O.S. iPhone app is coming soon to the App Store. Get notified at launch.',
  alternates: { canonical: '/download/' },
};

// Kept so older links still resolve. S.O.S. is not yet in the App Store,
// so this page shows launch status instead of install links.
export default function LaunchStatusPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#05080d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      color: '#F7F8FA',
      padding: '40px 20px',
      textAlign: 'center',
    }}>
      <img src="/brand/sos-logo.webp" alt="S.O.S. — Superheros On Standby" width={180} style={{ height: 'auto', marginBottom: 24 }} />
      <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0 0 12px' }}>Coming soon to the App Store</h1>
      <p style={{ color: 'rgba(247,248,250,.75)', fontSize: '1.05rem', maxWidth: 420, lineHeight: 1.6, margin: '0 0 28px' }}>
        S.O.S. brings roadside SUPERHEROS to Atlanta drivers. Leave your email and we’ll tell you the day it launches.
      </p>
      <a href="/#notify" style={{ background: '#E3000B', color: '#fff', padding: '16px 28px', borderRadius: 12, fontWeight: 800, textDecoration: 'none' }}>
        Get notified at launch
      </a>
      <a href="/hero/apply/" style={{ marginTop: 16, color: '#fff', fontWeight: 700 }}>Become a SUPERHERO</a>
    </div>
  );
}
