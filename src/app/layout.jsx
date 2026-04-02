export const metadata = {
  title: 'SOS — Superheroes On Standby | Roadside Rescue',
  description: 'Roadside assistance when you need it most. Flat tires, dead batteries, lockouts, towing — verified Heroes dispatched in minutes. 8 service categories, 40+ services.',
  keywords: 'roadside assistance, towing, flat tire help, dead battery, lockout, mobile mechanic, car wash, roadside rescue, Atlanta roadside',
  authors: [{ name: 'The Kollective Hospitality Group' }],
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
  viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover', userScalable: false },
  themeColor: '#080c14',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, background: '#080808', color: '#fff', fontFamily: '"DM Sans", sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
