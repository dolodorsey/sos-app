import { permanentRedirect } from 'next/navigation';

export default function BecomeAHeroPage() {
  permanentRedirect('/hero/apply');
}
