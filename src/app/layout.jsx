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
import '../components/prelaunch/sos-prelaunch.css';

export const metadata = {
  title: 'S.O.S. — Superheros On Standby',
  description: 'S.O.S. — Superheros On Standby is building a verified roadside and mobile vehicle-service network in Atlanta. Pre-launch: not accepting service requests. SUPERHEROS is the brand’s intentional spelling.',
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
  themeColor: '#070e1a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="/sos-safety-guard.js" defer />
        {/* Pre-launch (issue #103): the native shell no longer forces / -> /app/. Web and Capacitor
            both open the public landing; /app stays behind the internal-access gate. */}
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
