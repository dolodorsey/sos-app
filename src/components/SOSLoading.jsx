'use client';

export default function SOSLoading({ label = 'Connecting roadside support' }) {
  return (
    <div className="sos-runtime-loading" role="status" aria-live="polite">
      <div className="sos-runtime-loading__radar" aria-hidden="true">
        <div className="sos-runtime-loading__core">SOS</div>
      </div>
      <div className="sos-runtime-loading__eyebrow">Superheroes on standby</div>
      <div className="sos-runtime-loading__label">{label}</div>
      <style jsx>{`
        .sos-runtime-loading {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 28px;
          text-align: center;
          color: #fff;
          background:
            radial-gradient(circle at 50% 24%, rgba(255, 107, 53, .2), transparent 28%),
            linear-gradient(180deg, #111a29 0%, #05080d 78%);
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .sos-runtime-loading__radar {
          width: 96px;
          height: 96px;
          display: grid;
          place-items: center;
          margin-bottom: 24px;
          border: 1px solid rgba(255, 107, 53, .3);
          border-radius: 50%;
          background: repeating-radial-gradient(circle, transparent 0 15px, rgba(255, 107, 53, .1) 16px 17px);
          animation: sos-radar 1.8s ease-in-out infinite;
        }
        .sos-runtime-loading__core {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border-radius: 19px;
          color: #fff;
          background: linear-gradient(135deg, #ff7b45, #e5432f);
          box-shadow: 0 16px 38px rgba(229, 67, 47, .32);
          font-weight: 900;
          letter-spacing: -.04em;
        }
        .sos-runtime-loading__eyebrow {
          color: #ff9b68;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .2em;
          text-transform: uppercase;
        }
        .sos-runtime-loading__label {
          margin-top: 10px;
          color: rgba(255, 255, 255, .66);
          font-size: 14px;
        }
        @keyframes sos-radar {
          0%, 100% { transform: scale(.96); opacity: .75; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sos-runtime-loading__radar { animation: none; }
        }
      `}</style>
    </div>
  );
}
