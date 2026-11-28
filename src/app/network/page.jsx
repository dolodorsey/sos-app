import SOSNetworkPortalLoader from './SOSNetworkPortalLoader';

export const metadata = {
  title: 'THE SIGNAL · S.O.S. Superhero Network | Superheros On Standby',
  description: 'Members of the S.O.S. Superhero Network pick missions, log introductions and track verified points. Invite-only during the Atlanta pilot.',
  alternates: { canonical: '/network/' },
  robots: { index: false, follow: false },
};

export default function NetworkPage() {
  return <SOSNetworkPortalLoader />;
}
