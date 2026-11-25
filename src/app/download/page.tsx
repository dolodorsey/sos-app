export const metadata = {
  title: "SOS - Android Download",
  description: "Download the SOS Android app directly.",
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

        <a
          href="https://dzlmtvodpyhetvektfuo.supabase.co/storage/v1/object/public/apks/sos-release.apk"
          download="sos-release.apk"
          style={{
            background: "#E53E3E",
            color: "#080808",
            padding: "18px 32px",
            borderRadius: "12px",
            fontWeight: 800,
            fontSize: "1.05rem",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          ⬇ Download for Android
        </a>

        <a
          href="https://testflight.apple.com"
          style={{
            background: "transparent",
            color: "#F5F0E8",
            padding: "16px 32px",
            borderRadius: "12px",
            fontWeight: 600,
            fontSize: "1rem",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            border: "1px solid rgba(245,240,232,0.2)",
          }}
        >
           Download for iPhone (TestFlight)
        </a>

      </div>

      <div style={{ marginTop: "40px", maxWidth: "300px" }}>
        <p style={{ color: "rgba(245,240,232,0.4)", fontSize: "0.8rem", lineHeight: 1.6 }}>
          <strong style={{ color: "rgba(245,240,232,0.7)" }}>Android:</strong> After download, open the APK file.
          Enable <em>Install from Unknown Sources</em> in Settings if prompted.
        </p>
        <p style={{ color: "rgba(245,240,232,0.4)", fontSize: "0.8rem", lineHeight: 1.6, marginTop: "8px" }}>
          <strong style={{ color: "rgba(245,240,232,0.7)" }}>iPhone:</strong> TestFlight link opens the App Store.
          No Apple approval required — available immediately.
        </p>
      </div>

      <p style={{ marginTop: "48px", color: "rgba(245,240,232,0.25)", fontSize: "0.75rem" }}>
        The Kollective Hospitality Group · superherosonstandby.com
      </p>
    </div>
  );
}
