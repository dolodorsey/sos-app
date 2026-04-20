import React, { useState, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   S.O.S — NOT-911 DISCLAIMER GATE
   Required Apple App Store compliance screen for any app whose name,
   branding, or function could be confused with a true emergency service.
   
   Shows on first launch. Stores acceptance in localStorage.
   Always-accessible "View Disclaimer" link in-app for re-review.
   ═══════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'sos_not911_acknowledged_v1';

/* Palette must match SOSApp.jsx exactly */
const C = {
  bg: '#080c14',
  card: '#0d1320',
  accent: '#FF6B35',
  accentDk: '#E55A2B',
  gold: '#FFB347',
  red: '#EF4444',
  text: '#fff',
  sub: 'rgba(255,255,255,.78)',
  muted: 'rgba(255,255,255,.55)',
  border: 'rgba(255,255,255,.14)',
};
const ff = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";

/* Check if user has already acknowledged — safe for SSR */
export function hasAcknowledgedNot911() {
  if (typeof window === 'undefined') return false;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return false;
    const parsed = JSON.parse(v);
    return parsed?.accepted === true && parsed?.version === 1;
  } catch {
    return false;
  }
}

/* Haptic feedback if available */
const tap = async (style = 'Medium') => {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle[style] || ImpactStyle.Medium });
  } catch {}
};

/**
 * NotNineOneOneGate
 * @param {Object} props
 * @param {() => void} props.onAccept — called after user acknowledges
 * @param {boolean} [props.forceShow] — ignore localStorage, always show (for "View Disclaimer" re-review from in-app)
 * @param {() => void} [props.onDismiss] — called in forceShow mode when user closes without re-accepting
 */
export default function NotNineOneOneGate({ onAccept, forceShow = false, onDismiss }) {
  const [checked, setChecked] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const accept = async () => {
    await tap('Heavy');
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accepted: true,
          version: 1,
          accepted_at: new Date().toISOString(),
        })
      );
    } catch {}
    if (onAccept) onAccept();
  };

  const handleScroll = (e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) {
      setScrolled(true);
    }
  };

  const canContinue = checked && scrolled;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: C.bg,
        fontFamily: ff,
        color: C.text,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px 12px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${C.red}, ${C.accent})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 900,
            color: '#fff',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          ⚠
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.18em',
              color: C.accent,
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            Important Notice
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>
            SOS is <span style={{ color: C.red }}>NOT</span> a 911 service
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: `1px solid ${C.red}`,
            borderRadius: 14,
            padding: 18,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: C.red,
              textTransform: 'uppercase',
              letterSpacing: '.14em',
              marginBottom: 8,
            }}
          >
            If this is a life-threatening emergency
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.5, color: C.text, fontWeight: 600 }}>
            Stop. Close this app. Dial <span style={{ color: C.red, fontSize: 20 }}>911</span> now.
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: C.sub, marginTop: 10 }}>
            Examples: medical emergency, fire, violent crime in progress, car accident with injuries, life-threatening roadside situation.
          </div>
        </div>

        <div style={{ fontSize: 15, lineHeight: 1.6, color: C.sub, marginBottom: 16 }}>
          <strong style={{ color: C.text }}>Superheroes on Standby (SOS)</strong> is a private roadside-assistance and mobile-service dispatch marketplace. It connects you with independent service providers ("Heroes") for non-emergency help.
        </div>

        <SectionTitle>What SOS is</SectionTitle>
        <List
          items={[
            'Roadside assistance: jump starts, flat tires, lockouts, fuel delivery, towing.',
            'Mobile maintenance: oil changes, fluid top-ups, diagnostics, minor repairs.',
            'Car wash, detailing, and convenience services.',
            'Fleet and premium concierge services.',
          ]}
        />

        <SectionTitle>What SOS is NOT</SectionTitle>
        <List
          accent={C.red}
          items={[
            'A 911 emergency dispatch service.',
            'A police, fire, or medical response service.',
            'A substitute for calling 911 in a true emergency.',
            'A guaranteed response-time service. Heroes are independent contractors and dispatch depends on availability.',
          ]}
        />

        <SectionTitle>Dispatch & response</SectionTitle>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: C.sub, marginBottom: 16 }}>
          When you request a service, SOS matches your request to available Heroes in your area. Response times are estimates, not guarantees. Heroes are independent contractors, not employees of The Kollective Hospitality Group. SOS does not guarantee that a Hero will be available or that your request will be fulfilled.
        </div>

        <SectionTitle>Medical & safety situations</SectionTitle>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: C.sub, marginBottom: 16 }}>
          Do not use SOS if you are injured, unsafe, or in immediate danger. SOS cannot provide medical care, rescue, or protection. Always call 911 or your local emergency number first. You may use SOS afterward for non-emergency vehicle needs once you are safe.
        </div>

        <SectionTitle>Liability</SectionTitle>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: C.sub, marginBottom: 16 }}>
          By using SOS, you acknowledge that The Kollective Hospitality Group, its officers, employees, and affiliates are not liable for any damages, injuries, or losses resulting from your use of the app, including delays in response, actions of independent Heroes, or decisions to use SOS instead of calling 911 in an emergency.
        </div>

        <div style={{ fontSize: 12, color: C.muted, marginTop: 20, marginBottom: 12 }}>
          Continue scrolling to acknowledge.
        </div>
      </div>

      {/* Footer / actions */}
      <div
        style={{
          padding: '16px 24px 24px',
          borderTop: `1px solid ${C.border}`,
          background: C.card,
        }}
      >
        <label
          htmlFor="not911-ack"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 14px',
            background: checked ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${checked ? '#10B981' : C.border}`,
            borderRadius: 12,
            cursor: 'pointer',
            marginBottom: 14,
            transition: 'all .15s',
          }}
        >
          <input
            id="not911-ack"
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              setChecked(e.target.checked);
              if (e.target.checked) tap('Light');
            }}
            style={{
              width: 22,
              height: 22,
              accentColor: '#10B981',
              marginTop: 1,
              flexShrink: 0,
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: 14, lineHeight: 1.4, color: C.text, fontWeight: 500 }}>
            I understand SOS is <strong>not a 911 service</strong> and I will call 911 in any life-threatening emergency.
          </span>
        </label>

        {!scrolled && (
          <div
            style={{
              fontSize: 12,
              color: C.muted,
              textAlign: 'center',
              marginBottom: 10,
              fontStyle: 'italic',
            }}
          >
            ↑ Please scroll through the full disclaimer
          </div>
        )}

        <button
          onClick={accept}
          disabled={!canContinue}
          style={{
            width: '100%',
            padding: '16px 20px',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '.02em',
            color: canContinue ? '#fff' : 'rgba(255,255,255,0.4)',
            background: canContinue
              ? `linear-gradient(135deg, ${C.accent}, ${C.accentDk})`
              : 'rgba(255,255,255,0.06)',
            border: 'none',
            borderRadius: 14,
            cursor: canContinue ? 'pointer' : 'not-allowed',
            transition: 'all .15s',
            boxShadow: canContinue ? '0 6px 18px rgba(255,107,53,0.35)' : 'none',
          }}
        >
          I Understand · Continue to SOS
        </button>

        {forceShow && onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              width: '100%',
              marginTop: 10,
              padding: '12px',
              fontSize: 13,
              fontWeight: 600,
              color: C.sub,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '.18em',
        color: C.gold,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {children}
    </div>
  );
}

function List({ items, accent }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: 'flex',
            gap: 10,
            padding: '6px 0',
            fontSize: 14,
            lineHeight: 1.5,
            color: C.sub,
          }}
        >
          <span
            style={{
              color: accent || C.accent,
              fontWeight: 900,
              flexShrink: 0,
              fontSize: 16,
              lineHeight: 1.4,
            }}
            aria-hidden="true"
          >
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
