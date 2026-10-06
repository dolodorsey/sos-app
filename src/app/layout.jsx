import './globals.css';
import '../components/sos-mobility.css';
import '../components/sos-customer-v2.css';
import '../components/sos-elite.css';
import '../components/sos-desktop-final.css';
import '../components/sos-membership.css';
import '../components/sos-profile-tools.css';
import '../components/sos-operations-command.css';
import '../components/sos-root-layout-rescue.css';
import '../components/sos-current-media.css';
import '../components/sos-ui-v3.css';
import '../components/sos-ui-v3-desktop-fix.css';
import '../components/sos-authority.css';
import SOSAuthConfirmationGuard from '../components/SOSAuthConfirmationGuard';
import SOSAuthRedirectSessionHost from '../components/SOSAuthRedirectSessionHost';
import SOSPasswordRecoveryHost from '../components/SOSPasswordRecoveryHost';
import SOSSessionRefreshHost from '../components/SOSSessionRefreshHost';
import SOSMarketplaceTruthHost from '../components/SOSMarketplaceTruthHost';
import SOSAccountDeletionHost from '../components/SOSAccountDeletionHost';
import SOSUIUpgradeHost from '../components/SOSUIUpgradeHost';
import SOSRouteShell from '../components/SOSRouteShell';
import KHGTrackingHost from '../components/KHGTrackingHost';
import SOSInstallAppPromptClient from '../components/SOSInstallAppPromptClient';
import '../components/sos-responsive-contract.css';
import '../components/sos-app-native-contract.css';

export const metadata = {
  title: 'S.O.S. — Superheros On Standby | Roadside Mobility Network',
  description: 'Superheros On Standby connects customers with real roadside help and tracks Hero matching and mission progress. SUPERHEROS is the brand’s intentional spelling.',
  keywords: 'SUPERHEROS, Superheros On Standby, S.O.S., SOS, roadside assistance, towing, flat tire help, dead battery, vehicle lockout, mobile mechanic, roadside support',
  authors: [{ name: 'S.O.S. — Superheros On Standby' }],
  metadataBase: new URL('https://thesuperherosonstandby.com'),
  alternates: { canonical: '/' },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'S.O.S. — Superheros On Standby',
    description: 'SUPERHEROS is the intentionally spelled S.O.S. brand term for real people who show up when help is needed.',
    type: 'website',
    url: 'https://thesuperherosonstandby.com',
    siteName: 'S.O.S. — Superheros On Standby',
  },
  twitter: {
    card: 'summary',
    title: 'S.O.S. — Superheros On Standby',
    description: 'SUPERHEROS: real people who show up when help is needed.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: false,
  themeColor: '#020609',
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
        <KHGTrackingHost/>
        <SOSSessionRefreshHost/>
        <SOSMarketplaceTruthHost/>
        <SOSAccountDeletionHost/>
        <SOSRouteShell>{children}</SOSRouteShell>
        <SOSUIUpgradeHost/>
        <SOSAuthRedirectSessionHost/>
        <SOSAuthConfirmationGuard/>
        <SOSPasswordRecoveryHost/>
        <SOSInstallAppPromptClient/>
      </body>
    </html>
  );
}
