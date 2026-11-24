'use client';
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styles from './SOSHeroIntro.module.css';

// Full-screen brand intro that service providers see when they land on the
// Hero sign-up (sosatl.com sends them here). Plays once per visit, then fades
// away on its own. Skip anytime. Phones only allow muted autoplay, so it
// starts muted with a "Tap for sound" button.
const VIDEO = '/brand/intro/sos-hero-intro.mp4';
const POSTER = '/brand/intro/sos-hero-intro-poster.jpg';
const SEEN_KEY = 'sos_hero_intro_seen';
const MAX_MS = 13000; // never block the form longer than this, even if the video stalls
const FADE_MS = 600;

export default function SOSHeroIntro() {
  const [phase, setPhase] = useState('off'); // off | on | leaving
  const [muted, setMuted] = useState(true);
  const video = useRef(null);
  const closing = useRef(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) {}
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const skipParam = new URLSearchParams(location.search).has('nointro');
    if (seen || reduced || skipParam) return;
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    setPhase('on');
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setPhase('leaving');
    setTimeout(() => setPhase('off'), FADE_MS);
  };

  useEffect(() => {
    if (phase !== 'on') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const v = video.current;
    if (v) {
      v.muted = true;
      const p = v.play();
      if (p && p.catch) p.catch(() => close()); // autoplay refused: get out of the way
    }
    const cap = setTimeout(close, MAX_MS);
    const onKey = e => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    return () => { clearTimeout(cap); removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [phase]);

  if (phase === 'off') return null;

  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.paused) v.play().catch(() => {});
  };

  return createPortal(
    <div className={`${styles.overlay} ${phase === 'leaving' ? styles.leaving : ''}`} role="dialog" aria-modal="true" aria-label="S.O.S. Superheros On Standby intro" data-hero-intro>
      <video
        ref={video}
        className={styles.video}
        src={VIDEO}
        poster={POSTER}
        muted
        playsInline
        autoPlay
        preload="auto"
        onEnded={close}
        onError={close}
      />
      <div className={styles.controls}>
        <button type="button" className={styles.sound} onClick={toggleSound} aria-pressed={!muted}>
          {muted ? 'Tap for sound' : 'Sound on'}
        </button>
        <button type="button" className={styles.skip} onClick={close}>
          Skip
        </button>
      </div>
    </div>,
    document.body
  );
}
