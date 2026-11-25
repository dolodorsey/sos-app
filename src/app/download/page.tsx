export const metadata = {
  title: "Get the S.O.S. app",
  description: "Add S.O.S. to your phone's Home Screen. No App Store needed.",
};

// Until S.O.S. is live on the App Store, the app is the installable web app.
// Each button opens the right side of the app with ?install=1, which opens the
// install sheet and walks the visitor through Add to Home Screen.
const button = {
  padding: "18px 32px",
  borderRadius: "12px",
  fontWeight: 800,
  fontSize: "1.05rem",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
};

export default function DownloadPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      color: "#F5F0E8",
      padding: "40px 20px",
      textAlign: "center",
    }}>

      <div style={{ marginBottom: "32px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/sos-logo.webp" alt="S.O.S. Superheros On Standby" width={220} height={200} style={{ display: "block", width: "220px", height: "auto", margin: "0 auto 16px" }} />
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Get the S.O.S. app
        </h1>
        <p style={{ color: "#E53E3E", fontSize: "1rem", margin: 0 }}>
          Roadside help in Atlanta. One tap away.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%", maxWidth: "320px" }}>
        <a href="/app/?install=1" style={{ ...button, background: "#E53E3E", color: "#080808" }}>
          Add S.O.S. to my phone
        </a>
        <a href="/hero/apply/?install=1" style={{ ...button, background: "transparent", color: "#F5F0E8", fontWeight: 600, fontSize: "1rem", border: "1px solid rgba(245,240,232,0.2)" }}>
          I&apos;m a SUPERHERO (service provider)
        </a>
      </div>

      <div style={{ marginTop: "40px", maxWidth: "300px" }}>
        <p style={{ color: "rgba(245,240,232,0.4)", fontSize: "0.8rem", lineHeight: 1.6 }}>
          <strong style={{ color: "rgba(245,240,232,0.7)" }}>iPhone:</strong> open this page in Safari, tap Share, then Add to Home Screen.
        </p>
        <p style={{ color: "rgba(245,240,232,0.4)", fontSize: "0.8rem", lineHeight: 1.6, marginTop: "8px" }}>
          <strong style={{ color: "rgba(245,240,232,0.7)" }}>Android:</strong> open this page in Chrome, tap Install app.
        </p>
        <p style={{ color: "rgba(245,240,232,0.4)", fontSize: "0.8rem", lineHeight: 1.6, marginTop: "8px" }}>
          Opened from Instagram or Facebook? Tap ••• and choose Open in browser first.
        </p>
      </div>

      <p style={{ marginTop: "48px", color: "rgba(245,240,232,0.25)", fontSize: "0.75rem" }}>
        S.O.S. is roadside assistance, not an emergency service. In an emergency, call 911.
      </p>
    </div>
  );
}
