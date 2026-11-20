import SOSHome from '@/components/SOSHome';

// Web front door. The packaged app is sent to /app/ by the root layout before
// paint, so native users keep the full customer entry point at /app.
export default function HomePage() {
  return <SOSHome />;
}
