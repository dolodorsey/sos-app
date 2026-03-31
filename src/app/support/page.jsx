export default function Support() {
  return (
    <main style={{ minHeight: '100vh', background: '#080808', color: '#fff', padding: '60px 24px', fontFamily: '"DM Sans", sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 48, fontWeight: 300, marginBottom: 32 }}>Support</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, fontSize: 14 }}>
          Need help with SOS? We're here for you.
        </p>
        <div style={{ marginTop: 40, padding: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 22, fontWeight: 400, marginBottom: 12 }}>Contact Support</h3>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6 }}>
            Email: info@thekollectivehospitalitygroup.com
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
            Response time: Within 24 hours
          </p>
        </div>
        <div style={{ marginTop: 20, padding: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 22, fontWeight: 400, marginBottom: 12 }}>FAQ</h3>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6 }}>
            <strong style={{ color: '#fff' }}>How do I submit an inquiry?</strong><br/>
            Tap "Get In Touch" on the home screen and fill out the form.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, marginTop: 16 }}>
            <strong style={{ color: '#fff' }}>Is my information secure?</strong><br/>
            Yes. All data is encrypted and we never sell personal information.
          </p>
        </div>
      </div>
    </main>
  );
}
