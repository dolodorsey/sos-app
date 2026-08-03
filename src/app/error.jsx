'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error('SOS route failure', error);
  }, [error]);

  return (
    <div className="sos-route-error" role="alert">
      <div className="sos-route-error__shield">SOS</div>
      <div className="sos-route-error__eyebrow">Response network interrupted</div>
      <h1>We lost the connection.</h1>
      <p>Your account and request history remain available. Reconnect to reopen the SOS response network.</p>
      <button type="button" onClick={reset}>Reconnect SOS</button>
      <style jsx>{`
        .sos-route-error {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
          color: #fff;
          background:
            radial-gradient(circle at 50% 18%, rgba(239, 68, 68, .18), transparent 34%),
            linear-gradient(180deg, #111827 0%, #05080d 78%);
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .sos-route-error__shield {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          margin-bottom: 22px;
          border: 1px solid rgba(255, 107, 53, .5);
          border-radius: 24px 24px 30px 30px;
          color: #fff;
          background: linear-gradient(135deg, #ff7b45, #dc2626);
          box-shadow: 0 18px 44px rgba(220, 38, 38, .25);
          font-weight: 900;
        }
        .sos-route-error__eyebrow {
          color: #ff9b68;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .2em;
          text-transform: uppercase;
        }
        h1 {
          max-width: 360px;
          margin: 12px 0 10px;
          font-size: clamp(34px, 9vw, 48px);
          line-height: 1;
          letter-spacing: -.05em;
        }
        p {
          max-width: 380px;
          margin: 0 0 24px;
          color: rgba(255, 255, 255, .64);
          font-size: 14px;
          line-height: 1.6;
        }
        button {
          min-height: 50px;
          padding: 0 24px;
          border: 0;
          border-radius: 14px;
          color: #fff;
          background: linear-gradient(135deg, #ff7b45, #dc2626);
          font-weight: 900;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
