'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './SOSNetworkPortal.module.css';
import PasswordInput from './PasswordInput';
import {
  CATEGORY_LABEL, STAGE_LABEL, WEEK, inviteLink, networkRpc, networkSignIn, networkSignOut, restoreNetworkSession,
} from '@/lib/sosNetwork';

const CATEGORIES = ['social', 'customer', 'provider', 'street', 'quality'];
const SERVICES = [
  ['Tow', 'When a vehicle needs to be moved'],
  ['Vehicle lockout', 'When the keys are locked inside'],
  ['Fuel delivery', 'When a vehicle runs out of gas'],
  ['Tire change', 'When a flat needs the spare put on'],
  ['Battery jump', 'When the car will not start'],
];
const FAQ = [
  ['Do I have to work for S.O.S.?', 'No. You support by choice. Paid roles have their own agreement.'],
  ['Do I need a car?', 'No. Pick social, referral, testing or other missions.'],
  ['Are points money?', 'No. Points are recognition. Merchandise and benefits come only after the rules, budget and stock are approved.'],
  ['Can I test a live roadside request?', 'Only if the QA lead assigns it to you in writing. Never create a fake rescue.'],
  ['Can I stop?', 'Yes. Tell the program team and we pause your missions and messages.'],
];
const LANES_SELF_SERVE = ['street_team', 'creators', 'scouts', 'test_pilots', 'business_allies'];

function readInviteCode() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('code') || '';
}

export default function SOSNetworkPortal() {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [catalog, setCatalog] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([networkRpc('sos_network_catalog'), networkRpc('sos_network_me')]);
    setCatalog(c);
    setMe(m);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await restoreNetworkSession();
        if (s) { setSession(s); await load(); }
      } catch (e) { setError(e.message); } finally { setBooting(false); }
    })();
  }, [load]);

  const run = async (key, fn, okMessage) => {
    setBusy(key); setError(''); setNotice('');
    try { await fn(); if (okMessage) setNotice(okMessage); await load(); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(''); }
  };

  if (booting) return <main className={styles.page}><div className={styles.loading}>Loading THE SIGNAL…</div></main>;
  if (!session) return <SignIn onSignedIn={async (s) => { setSession(s); setError(''); try { await load(); } catch (e) { setError(e.message); } }} />;
  if (!catalog || !me) return <main className={styles.page}><div className={styles.shell}>{error ? <div className={styles.error}>{error}</div> : <div className={styles.loading}>Loading…</div>}</div></main>;

  const signOut = async () => { await networkSignOut(); setSession(null); setMe(null); };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.top}>
          <div className={styles.brand}><img className={styles.logo} src="/brand/sos-logo.webp" alt="S.O.S. Superheros On Standby" width="56" height="56" /><div><strong>THE SIGNAL</strong><small>S.O.S. SUPERHERO NETWORK · ATLANTA</small></div></div>
          <button className={styles.ghost} onClick={signOut}>Sign out</button>
        </header>
        {error && <div className={styles.error} role="alert">{error}</div>}
        {notice && <div className={styles.notice} role="status">{notice}</div>}
        {me.member
          ? <Member me={me} catalog={catalog} busy={busy} run={run} />
          : <Join catalog={catalog} busy={busy} run={run} email={session?.user?.email} />}
        <footer className={styles.footer}>
          <strong>ALL SUPERHEROS DONT WEAR CAPES!</strong>
          <span>superherosonstandby.com · @superheros.onstandby · Provider sign-up: SOSatl.com</span>
          <span>For immediate danger, call 911. Never do roadside work unless you are qualified and authorized.</span>
        </footer>
      </div>
    </main>
  );
}

function SignIn({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const code = readInviteCode();
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { onSignedIn(await networkSignIn(email.trim(), password)); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <main className={styles.page}>
      <div className={styles.authWrap}>
        <section className={styles.authPitch}>
          <span className={styles.kicker}>S.O.S. SUPERHERO NETWORK</span>
          <h1>You don’t have to drive a tow truck to be a SUPERHERO.</h1>
          <p>Share, introduce, test and represent S.O.S. across Atlanta. Pick the missions you want, track your verified impact and move up the ranks.</p>
          <ul className={styles.pitchList}>
            <li><b>55</b> missions</li><li><b>11</b> lanes</li><li><b>8</b> sides of town</li><li><b>100</b> founding spots</li>
          </ul>
          {code && <div className={styles.codeBanner}>Your invite code <b>{code.toUpperCase()}</b> is saved. Sign in to use it.</div>}
        </section>
        <form className={styles.authForm} onSubmit={submit}>
          <h2>Sign in</h2>
          <p>Use your S.O.S. account. No account yet? <a href="/login">Create one in the S.O.S. app</a>, then come back here.</p>
          <label className={styles.field}>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className={styles.field}>Password<PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <div className={styles.error} role="alert">{error}</div>}
          <button className={styles.primary} disabled={busy}>{busy ? 'Signing in…' : 'Enter THE SIGNAL'}</button>
          <a className={styles.smallLink} href="/login">Forgot your password? Reset it in the S.O.S. app</a>
        </form>
      </div>
    </main>
  );
}

function Join({ catalog, busy, run, email }) {
  const program = catalog.program || {};
  const [name, setName] = useState('');
  const [territory, setTerritory] = useState('');
  const [lanes, setLanes] = useState([]);
  const [channel, setChannel] = useState('text');
  const [shirt, setShirt] = useState('');
  const [code, setCode] = useState(readInviteCode());
  const [consent, setConsent] = useState(false);
  const [conduct, setConduct] = useState(false);
  const divisions = (catalog.divisions || []).filter((d) => LANES_SELF_SERVE.includes(d.id));
  const toggle = (id) => setLanes((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const submit = (e) => {
    e.preventDefault();
    run('join', () => networkRpc('sos_network_join', {
      p_display_name: name, p_territory: territory, p_divisions: lanes, p_invite_code: code || null,
      p_contact_channel: channel, p_consent: consent, p_conduct: conduct, p_shirt_size: shirt || null,
    }), 'Welcome to the network. Start with your first five missions below.');
  };
  return (
    <form className={styles.joinCard} onSubmit={submit}>
      <span className={styles.kicker}>JOIN THE NETWORK</span>
      <h1>Pick your lane. Claim your side of town.</h1>
      <p className={styles.lede}>Signed in as {email}. {program.enrollment === 'invite_only' ? 'Right now the network is invite-only: enter the code from your invitation or from a member.' : 'Enter an invite code if someone invited you.'}</p>
      <div className={styles.formGrid}>
        <label className={styles.field}>Your name<input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" /></label>
        <label className={styles.field}>Invite code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="F100… or a member code" /></label>
        <label className={styles.field}>Best way to reach you
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="text">Text</option><option value="email">Email</option><option value="instagram">Instagram</option><option value="phone">Phone call</option><option value="in_person">In person</option>
          </select>
        </label>
        <label className={styles.field}>Shirt size (optional)
          <select value={shirt} onChange={(e) => setShirt(e.target.value)}>
            <option value="">Skip for now</option>{['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <fieldset className={styles.fieldset}>
        <legend>Your side of town</legend>
        <div className={styles.chips}>
          {(catalog.territories || []).map((t) => (
            <button type="button" key={t.id} className={territory === t.id ? styles.chipOn : styles.chip} onClick={() => setTerritory(t.id)} aria-pressed={territory === t.id}>
              <b>{t.label}</b><small>{t.hint}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend>Extra lanes (optional — everyone starts as an Insider)</legend>
        <div className={styles.chips}>
          {divisions.map((d) => (
            <button type="button" key={d.id} className={lanes.includes(d.id) ? styles.chipOn : styles.chip} onClick={() => toggle(d.id)} aria-pressed={lanes.includes(d.id)}>
              <b>{d.label}</b><small>{d.primary_output}</small>
            </button>
          ))}
        </div>
        <p className={styles.hint}>Founding 100, Ambassadors, Captains and Secret Agents are assigned by the S.O.S. team.</p>
      </fieldset>
      <div className={styles.terms}>
        <label><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I’m joining by choice. Membership is not a job, not provider approval and not a promise of pay. Points are recognition, not money. S.O.S. may contact me about the network on the channel I picked, and I can stop at any time. (Terms version {program.terms_version})</label>
        <label><input type="checkbox" checked={conduct} onChange={(e) => setConduct(e.target.checked)} /> I’ll follow the safety and conduct rules: I’ll say I support S.O.S. when I post, I won’t share anyone’s contact without their okay, I won’t make fake reviews or fake rescues, and I won’t stand in traffic or put anything on a car without the owner’s okay.</label>
      </div>
      <button className={styles.primary} disabled={busy === 'join' || !territory || !consent || !conduct}>{busy === 'join' ? 'Joining…' : 'Join THE SIGNAL'}</button>
    </form>
  );
}

function Member({ me, catalog, busy, run }) {
  const m = me.member;
  const rank = me.rank || {};
  const [tab, setTab] = useState('first');
  const [open, setOpen] = useState('');
  const [copied, setCopied] = useState(false);
  const program = catalog.program || {};
  const missions = catalog.missions || [];
  const subsByMission = useMemo(() => Object.fromEntries((me.submissions || []).map((s) => [s.mission_id, s])), [me.submissions]);
  const firstFive = missions.filter((x) => x.first_five);
  const firstDone = firstFive.filter((x) => subsByMission[x.id]?.status === 'approved').length + ((me.referrals || []).filter((r) => r.stage !== 'duplicate_hold').length >= 5 ? 1 : 0);
  const shown = tab === 'first' ? firstFive : missions.filter((x) => x.category === tab);
  const span = rank.next_at ? rank.next_at - rank.min_points : 1;
  const progress = rank.next_at ? Math.min(100, Math.round(((me.points - rank.min_points) / span) * 100)) : 100;
  const link = inviteLink(m.referral_code);
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } };

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.card}>
          <div className={styles.cardTop}><span>S.O.S. MEMBER</span><em>{m.founding_slot ? `FOUNDING ${m.founding_slot.replace('F100-', '#')}` : 'INSIDER'}</em></div>
          <strong className={styles.cardName}>{m.display_name}</strong>
          <div className={styles.cardMeta}><span>{m.member_code}</span><span>{m.territory}</span></div>
          <small className={styles.cardNote}>Membership card — not a provider credential.</small>
        </div>
        <div className={styles.impact}>
          <div className={styles.stat}><small>VERIFIED POINTS</small><strong>{me.points.toLocaleString()}</strong><span>{me.pending_points ? `${me.pending_points} waiting for review` : 'Nothing waiting for review'}</span></div>
          <div className={styles.stat}><small>RANK</small><strong>{rank.label}</strong><span>{rank.proposed_benefit}</span></div>
          <div className={styles.stat}><small>FIRST FIVE MISSIONS</small><strong>{firstDone} / {firstFive.length + 1}</strong><span>Four missions plus five real introductions</span></div>
          <div className={styles.stat}><small>PEOPLE YOU INVITED</small><strong>{me.invited_members}</strong><span>{(me.referrals || []).length} introductions logged</span></div>
          <div className={styles.progress}>
            <div className={styles.progressLabel}><span>{rank.label}</span><span>{rank.next_label ? `${Math.max(0, rank.next_at - me.points).toLocaleString()} points to ${rank.next_label}` : 'Top rank'}</span></div>
            <div className={styles.bar}><i style={{ width: `${progress}%` }} /></div>
          </div>
        </div>
      </section>
      {program.points_status !== 'approved' && <div className={styles.pilotNote}><b>Pilot:</b> point values are proposed and may change before launch. Merchandise and benefits start only after the rules and budget are approved.</div>}

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>MY MISSIONS</span><h2>Pick a mission. Send proof. Get verified.</h2></div></div>
        <div className={styles.tabs} role="tablist">
          <button role="tab" aria-selected={tab === 'first'} className={tab === 'first' ? styles.tabOn : styles.tab} onClick={() => setTab('first')}>First five</button>
          {CATEGORIES.map((c) => <button role="tab" key={c} aria-selected={tab === c} className={tab === c ? styles.tabOn : styles.tab} onClick={() => setTab(c)}>{CATEGORY_LABEL[c]}</button>)}
        </div>
        <div className={styles.missionGrid}>
          {shown.map((mission) => (
            <MissionCard key={mission.id} mission={mission} sub={subsByMission[mission.id]} open={open === mission.id}
              onOpen={() => setOpen(open === mission.id ? '' : mission.id)} busy={busy} run={run} onDone={() => setOpen('')} />
          ))}
          {tab === 'first' && (
            <article className={styles.mission}>
              <div className={styles.missionTop}><span>INTRODUCTIONS</span><em>Tracked one by one</em></div>
              <h3>Make five real introductions</h3>
              <p>Customers who could use roadside help or providers who do towing, lockouts, tires, fuel or jumps. Ask them first.</p>
              <a className={styles.secondaryLink} href="#referrals">Add an introduction ↓</a>
            </article>
          )}
        </div>
      </section>

      <section className={styles.section} id="referrals">
        <div className={styles.sectionHead}><div><span className={styles.kicker}>REFERRAL CENTER</span><h2>Your link. Your introductions.</h2></div></div>
        <div className={styles.twoCol}>
          <div className={styles.panel}>
            <h3>Your personal invite</h3>
            <p>People who join with your code are credited to you.</p>
            <div className={styles.codeBox}><code>{m.referral_code}</code><button className={styles.ghost} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button></div>
            <small className={styles.hint}>{link}</small>
            <div className={styles.scripts}>
              <h4>Ready-to-send lines</h4>
              <p><b>Customer:</b> If you ever get stuck on the road in Atlanta, S.O.S. sends help — tow, lockout, fuel, tire or jump. superherosonstandby.com</p>
              <p><b>Provider:</b> Do you know someone who does towing, lockouts, tire changes, fuel delivery or battery jumps? Have them apply at SOSatl.com. Our team handles qualification.</p>
              <p className={styles.hint}>Send these yourself to people you know. One reminder at most. If they say no, that’s it.</p>
            </div>
          </div>
          <ReferralForm busy={busy} run={run} referrals={me.referrals || []} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>RANKS</span><h2>Six ranks. Verified points only.</h2></div></div>
        <div className={styles.ranks}>
          {(catalog.ranks || []).map((r) => (
            <div key={r.id} className={r.id === rank.id ? styles.rankOn : styles.rank}>
              <strong>{r.label}</strong><span>{r.max_points ? `${r.min_points.toLocaleString()}–${r.max_points.toLocaleString()}` : `${r.min_points.toLocaleString()}+`}</span><small>{r.proposed_benefit}</small>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.threeCol}>
          <div className={styles.panel}>
            <h3>The week</h3>
            <ul className={styles.week}>{WEEK.map(([day, name, what]) => <li key={day}><b>{name}</b><span>{what}</span></li>)}</ul>
          </div>
          <div className={styles.panel}>
            <h3>What S.O.S. does</h3>
            <ul className={styles.week}>{SERVICES.map(([s, when]) => <li key={s}><b>{s}</b><span>{when}</span></li>)}</ul>
            <p className={styles.hint}>Service depends on Heroes being available near the person. Check the app before telling someone help is available.</p>
          </div>
          <div className={styles.panel}>
            <h3>Questions</h3>
            <ul className={styles.faq}>{FAQ.map(([q, a]) => <li key={q}><b>{q}</b><span>{a}</span></li>)}</ul>
          </div>
        </div>
      </section>

      {(me.submissions || []).length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span className={styles.kicker}>HISTORY</span><h2>Everything you submitted</h2></div></div>
          <div className={styles.table}>
            {(me.submissions || []).map((s) => (
              <div className={styles.row} key={s.id}>
                <span><b>{s.title}</b><small>{new Date(s.created_at).toLocaleDateString()}</small></span>
                <span className={s.status === 'approved' ? styles.good : s.status === 'rejected' ? styles.bad : styles.wait}>{s.status === 'approved' ? `Approved · +${s.points_awarded}` : s.status === 'rejected' ? 'Not approved' : 'Waiting for review'}</span>
                {s.reviewer_note && <small className={styles.reviewNote}>Reviewer: {s.reviewer_note}</small>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function MissionCard({ mission, sub, open, onOpen, busy, run, onDone }) {
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(`m-${mission.id}`, () => networkRpc('sos_network_submit_mission', { p_mission_id: mission.id, p_evidence_note: note, p_evidence_link: link || null }), `“${mission.title}” sent for review.`);
    if (ok) { setNote(''); setLink(''); onDone(); }
  };
  const state = sub ? sub.status : mission.restricted ? 'restricted' : 'open';
  return (
    <article className={`${styles.mission} ${state === 'approved' ? styles.missionDone : ''}`}>
      <div className={styles.missionTop}><span>{CATEGORY_LABEL[mission.category].toUpperCase()}</span><em>{mission.points} pts</em></div>
      <h3>{mission.title}</h3>
      <p>{mission.evidence_rule}</p>
      {state === 'approved' && <div className={styles.good}>Approved · +{sub.points_awarded} points</div>}
      {state === 'pending' && <div className={styles.wait}>Waiting for review</div>}
      {state === 'rejected' && <div className={styles.bad}>Not approved{sub.reviewer_note ? ` — ${sub.reviewer_note}` : ''}</div>}
      {state === 'restricted' && <div className={styles.wait}>Assigned by the QA lead only</div>}
      {state === 'open' && !open && <button className={styles.secondary} onClick={onOpen}>Submit proof</button>}
      {state === 'open' && open && (
        <form className={styles.proof} onSubmit={submit}>
          <label className={styles.field}>What did you do?<textarea required minLength={10} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Say what you did, when and where. Do not include anyone else’s phone number or private details." /></label>
          <label className={styles.field}>Proof link (optional)<input type="url" pattern="https://.*" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://instagram.com/p/…" /></label>
          <small className={styles.hint}>{mission.verification_standard}</small>
          <div className={styles.rowButtons}><button type="button" className={styles.ghost} onClick={onOpen}>Cancel</button><button className={styles.primarySmall} disabled={busy === `m-${mission.id}`}>{busy === `m-${mission.id}` ? 'Sending…' : 'Send for review'}</button></div>
        </form>
      )}
    </article>
  );
}

function ReferralForm({ busy, run, referrals }) {
  const [kind, setKind] = useState('customer');
  const [ref, setRef] = useState('');
  const [service, setService] = useState('');
  const [consent, setConsent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run('ref', () => networkRpc('sos_network_add_referral', { p_kind: kind, p_target_reference: ref, p_consent: consent, p_service_category: kind === 'provider' ? service || null : null }), 'Introduction logged. The S.O.S. team takes it from here.');
    if (ok) { setRef(''); setConsent(false); setService(''); }
  };
  return (
    <div className={styles.panel}>
      <h3>Log an introduction</h3>
      <p>Only add people who said it’s okay. An introduction is not a sale or an approved provider — the team confirms each step.</p>
      <form onSubmit={submit} className={styles.refForm}>
        <div className={styles.segment}>
          {[['customer', 'Customer'], ['provider', 'Provider'], ['business', 'Business']].map(([k, l]) => <button type="button" key={k} className={kind === k ? styles.segOn : styles.seg} onClick={() => setKind(k)} aria-pressed={kind === k}>{l}</button>)}
        </div>
        <label className={styles.field}>Name and how to reach them<input required minLength={3} maxLength={300} value={ref} onChange={(e) => setRef(e.target.value)} placeholder={kind === 'business' ? 'Business name, contact person, phone or email' : 'Name, phone or email'} /></label>
        {kind === 'provider' && (
          <label className={styles.field}>What they do
            <select value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">Pick one</option><option value="tow">Towing</option><option value="lockout">Lockouts / locksmith</option><option value="tire">Tire service</option><option value="fuel">Fuel delivery</option><option value="jump">Battery jumps</option><option value="mechanic">Mobile mechanic</option>
            </select>
          </label>
        )}
        <label className={styles.check}><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> They told me it’s okay for S.O.S. to reach out.</label>
        <button className={styles.primarySmall} disabled={busy === 'ref' || !consent}>{busy === 'ref' ? 'Saving…' : 'Log introduction'}</button>
      </form>
      {referrals.length > 0 && (
        <div className={styles.refList}>
          {referrals.map((r) => <div key={r.id} className={styles.refRow}><span><b>{r.target_reference}</b><small>{r.kind}</small></span><em>{STAGE_LABEL[r.stage] || r.stage}</em></div>)}
        </div>
      )}
    </div>
  );
}
