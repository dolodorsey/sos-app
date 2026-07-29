export const metadata = {
  title: 'SOS — Superheroes On Standby | Roadside Rescue',
  description: 'Roadside assistance when you need it most. Flat tires, dead batteries, lockouts, towing — verified Heroes dispatched in minutes. 8 service categories, 40+ services.',
  keywords: 'roadside assistance, towing, flat tire help, dead battery, lockout, mobile mechanic, car wash, roadside rescue, Atlanta roadside',
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
    title: 'SOS — Superheroes On Standby',
    description: 'Roadside assistance dispatched in minutes. Flat tires, lockouts, towing & more.',
    type: 'website',
    url: 'https://thesuperherosonstandby.com',
    siteName: 'SOS — Superheroes On Standby',
  },
  twitter: {
    card: 'summary',
    title: 'SOS — Superheroes On Standby',
    description: 'Roadside rescue dispatched in minutes. 40+ services.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: false,
  themeColor: '#080c14',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {/* Native (Capacitor) builds open the app shell directly, never the marketing page */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var c=window.Capacitor;if(c&&typeof c.isNativePlatform==='function'&&c.isNativePlatform()){var p=location.pathname;if(p==='/'||p==='/index.html'){location.replace('/app/');}}}catch(e){}})();",
          }}
        />
      </head>
      <body style={{ margin: 0, background: '#080808', color: '#fff', fontFamily: '"DM Sans", sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
