'use client';
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styles from './SOSHeroIntro.module.css';

// Full-screen brand intro service providers see when they land on the Hero
// sign-up (sosatl.com sends them here). It plays, then fades away on its own.
//
// It must actually be seen, on every phone:
// - Autoplay blocked (iPhone Low Power Mode, data saver) or Reduce Motion on:
//   show the first frame with a big Play button instead of disappearing.
// - Video slow to start: switch to the Play button rather than closing early.
// - Shown on every arrival; only held back if it already played in this tab
//   in the last few minutes (so a reload mid-application doesn't replay it).
// The form is never blocked for long: Skip anytime, it closes when the video
// ends, and an untouched Play screen closes itself after a short wait.
const VIDEO = '/brand/intro/sos-hero-intro.mp4';
const POSTER = '/brand/intro/sos-hero-intro-poster.jpg';
const SEEN_KEY = 'sos_hero_intro_seen_at';
const REPLAY_AFTER_MS = 5 * 60 * 1000;
const START_WAIT_MS = 6000; // autoplay must start within this, else show Play
const TAP_WAIT_MS = 20000; // an untouched Play screen closes after this
const PLAY_CAP_MS = 14000; // once playing, never longer than this
const FADE_MS = 600;

export default function SOSHeroIntro() {
  const [phase, setPhase] = useState('off'); // off | on | leaving
  const [mode, setMode] = useState('auto'); // auto | tap | playing
  const [muted, setMuted] = useState(true);
  const video = useRef(null);
  const closing = useRef(false);

  useEffect(() => {
    if (new URLSearchParams(location.search).has('nointro')) return;
    let last = 0;
    try { last = Number(sessionStorage.getItem(SEEN_KEY)) || 0; } catch (e) {}
    if (Date.now() - last < REPLAY_AFTER_MS) return;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMode(reduced ? 'tap' : 'auto');
    setPhase('on');
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    try { sessionStorage.setItem(SEEN_KEY, String(Date.now())); } catch (e) {}
    setPhase('leaving');
    setTimeout(() => setPhase('off'), FADE_MS);
  };

  // Lock page scroll and handle Escape while the intro is up.
  useEffect(() => {
    if (phase !== 'on') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [phase]);

  // Try muted autoplay; fall back to the Play button if refused or too slow.
  useEffect(() => {
    if (phase !== 'on' || mode !== 'auto') return;
    const v = video.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && p.catch) p.catch(() => setMode(m => (m === 'auto' ? 'tap' : m)));
    const wait = setTimeout(() => setMode(m => (m === 'auto' ? 'tap' : m)), START_WAIT_MS);
    return () => clearTimeout(wait);
  }, [phase, mode]);

  // Waiting for a tap: don't hold the form forever.
  useEffect(() => {
    if (phase !== 'on' || mode !== 'tap') return;
    const v = video.current;
    if (v && !v.paused) v.pause();
    const t = setTimeout(close, TAP_WAIT_MS);
    return () => clearTimeout(t);
  }, [phase, mode]);

  // Playing: hard cap so a stalled video can't trap anyone.
  useEffect(() => {
    if (phase !== 'on' || mode !== 'playing') return;
    const t = setTimeout(close, PLAY_CAP_MS);
    return () => clearTimeout(t);
  }, [phase, mode]);

  if (phase === 'off') return null;

  const tapToPlay = () => {
    const v = video.current;
    if (!v) return;
    v.muted = false; // a tap is a user gesture, so sound is allowed
    setMuted(false);
    try { v.currentTime = 0; } catch (e) {}
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => close()); });
  };

  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.paused) v.play().catch(() => {});
  };

  return createPortal(
    <div className={`${styles.overlay} ${phase === 'leaving' ? styles.leaving : ''}`} role="dialog" aria-modal="true" aria-label="S.O.S. Superheros On Standby intro" data-hero-intro data-intro-mode={mode}>
      <video
        ref={video}
        className={styles.video}
        src={VIDEO}
        poster={POSTER}
        muted
        playsInline
        preload="auto"
        onPlaying={() => setMode('playing')}
        onEnded={close}
        onError={close}
      />
      {mode === 'tap' && (
        <button type="button" className={styles.play} onClick={tapToPlay} aria-label="Play the S.O.S. intro">
          <span className={styles.playIcon} aria-hidden="true" />
          <span>Play</span>
        </button>
      )}
      <div className={styles.controls}>
        {mode === 'tap' ? <span /> : (
          <button type="button" className={styles.sound} onClick={toggleSound} aria-pressed={!muted}>
            {muted ? 'Tap for sound' : 'Sound on'}
          </button>
        )}
        <button type="button" className={styles.skip} onClick={close}>
          Skip
        </button>
      </div>
    </div>,
    document.body
  );
}
