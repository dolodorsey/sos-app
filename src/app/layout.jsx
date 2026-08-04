import './globals.css';
import '../components/sos-mobility.css';
import '../components/sos-customer-v2.css';

export const metadata = {
  title: 'S.O.S. — Superheroes On Standby | Roadside Mobility Network',
  description: 'Request verified roadside help, see real Hero matching status, and track confirmed mission progress. S.O.S. is not 911.',
  keywords: 'roadside assistance, towing, flat tire help, dead battery, vehicle lockout, mobile mechanic, roadside support Atlanta',
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
    description: 'Verified roadside assistance with real matching, assignment, payment, and mission tracking.',
    type: 'website',
    url: 'https://thesuperherosonstandby.com',
    siteName: 'S.O.S. — Superheroes On Standby',
  },
  twitter: {
    card: 'summary',
    title: 'S.O.S. — Superheroes On Standby',
    description: 'Roadside mobility with honest live mission states.',
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
