'use client';

import { useState } from 'react';

// The full, credentialed Hero application is preserved but invitation-only during
// pre-launch. The database (private.sos_prelaunch_guard on sos_hero_applications)
// rejects submissions from emails without an active S.O.S. invitation, so continuing
// past this notice does not bypass anything.
export default function SOSInviteOnlyNotice({ children }) {
  const [continued, setContinued] = useState(false);
  if (continued) return children;
  return (
    <div className="pl-gate">
      <main className="pl-gate-card">
        <img src="/brand/prelaunch/sos-shield-360.webp" alt="S.O.S. — Superheros On Standby" width="180" height="94" />
        <h1>Full application is by invitation</h1>
        <p>Before launch, S.O.S. starts with a one-minute early registration — no documents. Providers who are a fit for the services and areas we need are invited to this full application, where ID, license, insurance and background checks happen.</p>
        <div className="pl-actions">
          <a className="pl-btn pl-btn-primary" href="/become-a-hero/">Register early interest</a>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setContinued(true)}>I was invited — continue</button>
        </div>
        <p className="pl-gate-code">Invitations are tied to the email address S.O.S. invited. Submissions from other emails are not accepted before launch.</p>
      </main>
    </div>
  );
}
