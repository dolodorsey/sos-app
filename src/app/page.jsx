'use client';
import { Native } from "@/lib/native";

import { KHGFormButton } from '@/components/KHGForms';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: '#080808' }}>
      <section style={{
        minHeight: '80vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: '0 24px',
      }}>
        <h1 style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: 'clamp(48px, 12vw, 140px)', fontWeight: 300,
          letterSpacing: '-0.04em', lineHeight: 0.95, margin: 0, color: '#fff',
        }}>
          SOS
        </h1>
        <p style={{
          fontSize: 'clamp(13px, 1.4vw, 16px)', color: 'rgba(255,255,255,0.4)',
          marginTop: 20, maxWidth: 420, lineHeight: 1.6,
        }}>
          Part of The Kollective Hospitality Group
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
          <KHGFormButton formType="inquiry" brandKey="sos" variant="accent" size="lg" label="Get In Touch" />
          <KHGFormButton formType="sponsor" brandKey="sos" variant="outline" size="lg" />
        </div>
      </section>
      <section style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 300, color: '#fff',
          }}>
            Connect With Us
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 8 }}>
            See all options on our <a href="/connect" style={{ color: '#FF6B35', textDecoration: 'none' }}>connect page</a>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 800, margin: '0 auto' }}>
          <KHGFormButton formType="inquiry" brandKey="sos" />
          <KHGFormButton formType="consultation" brandKey="sos" />
          <KHGFormButton formType="hiring_inquiry" brandKey="sos" />
          <KHGFormButton formType="volunteer" brandKey="sos" />
          <KHGFormButton formType="rsvp" brandKey="sos" />
          <KHGFormButton formType="nda" brandKey="sos" />
        </div>
      </section>
    </main>
  );
}
