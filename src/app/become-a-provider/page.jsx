import { permanentRedirect } from 'next/navigation';

// Public recruiting aliases lead to the early-interest registration (issue #103).
export default function ProviderAliasPage() {
  permanentRedirect('/become-a-hero/');
}
