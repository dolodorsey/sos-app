// Server-side metadata for the client-rendered "not 911" notice.
export const metadata = {
  title: 'S.O.S. Is Not a 911 Service | Superheros On Standby',
  description: 'S.O.S. — Superheros On Standby is roadside assistance, not an emergency service. If anyone is hurt or in danger, call 911 first.',
  alternates: { canonical: '/legal/' },
};

export default function LegalLayout({ children }) {
  return children;
}
