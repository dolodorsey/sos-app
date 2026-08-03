import './globals.css';

export const metadata = {
  title: 'S.O.S. — Superheroes On Standby | Roadside Request Intake',
  description: 'Submit a roadside-support request, review the starting estimate, and track confirmed assignment status. S.O.S. is not 911 and does not replace emergency services.',
  keywords: 'roadside assistance request, towing request, flat tire help, dead battery, vehicle lockout, mobile mechanic, roadside support Atlanta',
  authors: [{ name: 'The Kollective Hospitality Group' }],
  metadataBase: new URL('https://thesuperherosonstandby.com'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'S.O.S. — Superheroes On Standby',
    description: 'Log a roadside request and see the real assignment status. Timing and payment are confirmed after an approved provider accepts the request.',
    type: 'website',
    url: 'https://thesuperherosonstandby.com',
    siteName: 'S.O.S. — Superheroes On Standby',
  },
  twitter: {
    card: 'summary',
    title: 'S.O.S. — Superheroes On Standby',
    description: 'Roadside request intake with honest pending and confirmed assignment states.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: false,
  themeColor: '#05080d',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="/sos-safety-guard.js" defer />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var c=window.Capacitor;if(c&&typeof c.isNativePlatform==='function'&&c.isNativePlatform()){var p=location.pathname;if(p==='/'||p==='/index.html'){location.replace('/app/');}}}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <div className="app-shell sos-premium" data-app="sos">{children}</div>
      </body>
    </html>
  );
}
