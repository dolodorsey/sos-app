import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SOS | The Kollective Hospitality Group',
  description: 'SOS - Part of The Kollective Hospitality Group',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, background: '#080808', color: '#fff', fontFamily: '"DM Sans", sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
