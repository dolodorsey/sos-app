// Route-specific public provider recruitment SEO. Applicant status and documents remain private.
export const metadata = {
  title: 'Become a Hero | S.O.S. — Superheros On Standby',
  description: 'Apply to join the S.O.S. roadside provider network. Share your services and credentials for review. Application does not guarantee approval, activation, or jobs.',
  alternates: { canonical: '/hero/apply/' },
  openGraph: {
    title: 'Become a Hero | S.O.S. — Superheros On Standby',
    description: 'Apply for review as a S.O.S. roadside service Hero. Approval and activation require verification.',
    url: 'https://thesuperherosonstandby.com/hero/apply/',
    type: 'website',
  },
};

export default function HeroApplyLayout({ children }) {
  return children;
}
