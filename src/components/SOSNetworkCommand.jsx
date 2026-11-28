'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './SOSNetworkCommand.module.css';
import PasswordInput from './PasswordInput';
import { CATEGORY_LABEL, STAGE_LABEL, STAGES_BY_KIND, pretty } from '@/lib/sosNetwork';

const SB = 'https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK = 'sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const headers = (token) => ({ apikey: SK, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const SLOT_STATUS = [
  ['not_selected', 'Not picked yet'], ['selected', 'Picked'], ['approved_to_invite', 'Approved to invite'], ['invited', 'Invited'],
  ['opted_in', 'Joined'], ['declined', 'Said no'], ['no_response', 'No response'],
];
const SLOT_LABEL = Object.fromEntries(SLOT_STATUS);
const OWNERS = ['Tay', 'Linda (Muse)', 'Omar', 'Kenny', 'Brian', 'Crystal', 'Ali', 'Pops', 'Dolo'];

async function rpc(token, name, body = {}) {
  const r = await fetch(`${SB}/rest/v1/rpc/${name}`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.message || d?.error || 'Request failed');
  return d;
}

export default function SOSNetworkCommand() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (token) => setData(await rpc(token, 'sos_ops_network_overview'));
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('sos_ops_session'));
      if (s?.access_token) { setSession(s); load(s.access_token).catch(() => { localStorage.removeItem('sos_ops_session'); setSession(null); }); }
    } catch { /* not signed in */ }
  }, []);

  const login = async (e) => {
    e.preventDefault(); setBusy('login'); setError('');
    try {
      const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: SK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error_description || 'Sign in failed');
      const ok = await rpc(d.access_token, 'marketplace_operator_check');
      if (ok !== true) throw new Error('This account is not an active S.O.S. operator.');
      localStorage.setItem('sos_ops_session', JSON.stringify(d)); setSession(d); await load(d.access_token);
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  };

  const act = async (key, name, body, ok) => {
    setBusy(key); setError(''); setNotice('');
    try { await rpc(session.access_token, name, body); setNotice(ok); await load(session.access_token); return true; } catch (err) {
      if (/JWT|expired/i.test(err.message)) { localStorage.removeItem('sos_ops_session'); setSession(null); setError('Your sign-in expired. Sign in again.'); } else setError(err.message);
      return false;
    } finally { setBusy(''); }
  };

  if (!session) {
    return (
      <main className={styles.page}>
        <form className={styles.auth} onSubmit={login}>
          <span className={styles.kicker}>S.O.S. · SUPERHERO NETWORK COMMAND</span>
          <h1>THE SIGNAL</h1>
          <p>Review missions, move introductions, run the Founding 100 and watch every side of town. Operators only.</p>
          <label className={styles.field}>Operator email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className={styles.field}>Password<PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.primary} disabled={busy === 'login'}>{busy === 'login' ? 'Signing in…' : 'Open Network Command'}</button>
        </form>
      </main>
    );
  }
  if (!data) return <main className={styles.page}><div className={styles.shell}>{error ? <div className={styles.error}>{error}</div> : <p className={styles.muted}>Loading Network Command…</p>}</div></main>;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.top}>
          <div><span className={styles.kicker}>S.O.S. · SUPERHERO NETWORK COMMAND</span><h1>THE SIGNAL</h1><p>Every mission, introduction and founding member — verified before it counts.</p></div>
          <div className={styles.topActions}>
            <button className={styles.ghost} onClick={() => act('refresh', 'sos_ops_network_overview', {}, 'Refreshed.')}>{busy === 'refresh' ? 'Refreshing…' : 'Refresh'}</button>
            <a className={styles.link} href="/network">Member portal ↗</a>
            <a className={styles.link} href="/ops">Operations Command →</a>
          </div>
        </header>
        {error && <div className={styles.error} role="alert">{error}</div>}
        {notice && <div className={styles.notice} role="status">{notice}</div>}
        <Approvals program={data.program} counts={data.counts} />
        <Summary counts={data.counts} />
        <Review data={data} busy={busy} act={act} />
        <Introductions referrals={data.referrals} busy={busy} act={act} />
        <Founding slots={data.founding_slots} territories={data.territories} busy={busy} act={act} />
        <Territories territories={data.territories} />
        <Members members={data.members} busy={busy} act={act} />
        <Recent decisions={data.recent_decisions} />
        <section className={styles.section}>
          <div className={styles.panel}>
            <h3>Operating rhythm</h3>
            <ul className={styles.rhythm}>
              <li><b>9:00 AM</b> Review new submissions and duplicate holds. Never review your own.</li>
              <li><b>12:00 PM</b> Post approved missions and content for members. No sends that Dolo has not approved.</li>
              <li><b>4:00 PM</b> Move introductions to their real stage, update kits.</li>
              <li><b>End of day</b> Check points and stock, list blockers.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

function Approvals({ program, counts }) {
  const items = [
    ['Approve the 55 mission point values', program.points_status === 'approved', 'Points show as proposed to members until you approve them.'],
    ['Approve member terms and the privacy notice', program.terms_version && !String(program.terms_version).includes('draft'), `Members are agreeing to the pilot draft (${program.terms_version}).`],
    ['Approve the pilot kit budget ($2,722.50)', program.rewards_status === 'approved', '100 supporter kits, 25 ambassador upgrades, 10 founding premium upgrades, field printing, test reserve and 10% extra. No kits are promised until approved.'],
    ['Approve the founder invitation message', false, 'The team sends invites by hand from their own phones, wave by wave of 25. Nothing is sent by the system.'],
    ['Pick the first 25 Founding members', counts.founding_selected >= 25, `${counts.founding_selected} of 100 founding spots have a real person picked.`],
    ['Open enrollment beyond invite codes', program.enrollment === 'open', `Enrollment is ${pretty(program.enrollment)} right now.`],
  ];
  return (
    <section className={styles.approvals}>
      <div className={styles.sectionHead}><div><span className={styles.kicker}>WAITING ON DOLO · S.O.S.</span><h2>Approvals before the network goes wide</h2></div><small>{items.filter((i) => !i[1]).length} open</small></div>
      <div className={styles.approvalGrid}>
        {items.map(([title, done, detail]) => (
          <article key={title} className={done ? styles.approvalDone : styles.approval}><em>{done ? 'DONE' : 'NEEDS YOUR YES'}</em><strong>{title}</strong><span>{detail}</span></article>
        ))}
      </div>
    </section>
  );
}

function Summary({ counts }) {
  const cards = [
    ['Members', counts.members, `${counts.test_members} test accounts not counted`],
    ['Active in the last 7 days', counts.active_7_days, 'At least one approved mission'],
    ['Waiting for review', counts.pending_reviews, 'Submissions to decide'],
    ['Missions approved', counts.approved_missions, `${Number(counts.points_awarded || 0).toLocaleString()} points awarded`],
    ['Founding 100', `${counts.founding_joined} joined`, `${counts.founding_selected} picked · ${counts.founding_invited} invited`],
    ['Customer introductions', counts.customer_intros, 'Not proof of a sign-up or sale'],
    ['Provider introductions', counts.provider_intros, 'Not proof of an approved Hero'],
    ['Business introductions', counts.business_intros, `${counts.duplicate_holds} on duplicate hold`],
  ];
  return (
    <section className={styles.summary}>
      {cards.map(([label, value, sub]) => <div className={styles.stat} key={label}><small>{label}</small><strong>{value}</strong><span>{sub}</span></div>)}
    </section>
  );
}

function Review({ data, busy, act }) {
  const [notes, setNotes] = useState({});
  const pending = data.pending || [];
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span className={styles.kicker}>REVIEW QUEUE</span><h2>Missions waiting for a decision</h2></div><small>{pending.length} waiting</small></div>
      {pending.length === 0 ? <div className={styles.empty}>Nothing waiting. New submissions show up here the moment a member sends proof.</div> : (
        <div className={styles.reviewGrid}>
          {pending.map((s) => (
            <article className={styles.reviewCard} key={s.id}>
              <div className={styles.reviewTop}><span>{CATEGORY_LABEL[s.category]?.toUpperCase()} · {s.points} POINTS</span>{s.is_test && <em className={styles.testTag}>TEST ACCOUNT</em>}</div>
              <h3>{s.mission}</h3>
              <p className={styles.who}>{s.member_name} · {s.member_code} · {s.territory} · {new Date(s.created_at).toLocaleString()}</p>
              <div className={styles.evidence}><small>WHAT THEY SAY THEY DID</small><p>{s.evidence_note}</p>{s.evidence_link && <a href={s.evidence_link} target="_blank" rel="noreferrer noopener">Open proof link ↗</a>}</div>
              <small className={styles.rule}>Needs: {s.evidence_rule}</small>
              {s.own_submission ? <div className={styles.warnBox}>This is your own submission. Another reviewer has to decide it.</div> : (
                <div className={styles.decide}>
                  <textarea placeholder="Note to the member (required if you reject)" value={notes[s.id] || ''} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} />
                  <div className={styles.decideButtons}>
                    <button className={styles.reject} disabled={busy === s.id} onClick={() => act(s.id, 'sos_ops_network_review_submission', { p_submission_id: s.id, p_decision: 'rejected', p_note: notes[s.id] || null }, `Rejected: ${s.mission}`)}>Reject</button>
                    <button className={styles.approve} disabled={busy === s.id} onClick={() => act(s.id, 'sos_ops_network_review_submission', { p_submission_id: s.id, p_decision: 'approved', p_note: notes[s.id] || null }, `Approved: ${s.mission} (+${s.points})`)}>Approve +{s.points}</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Introductions({ referrals, busy, act }) {
  const [edits, setEdits] = useState({});
  const groups = [['customer', 'Customers'], ['provider', 'Providers'], ['business', 'Businesses']];
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span className={styles.kicker}>INTRODUCTIONS</span><h2>Move each person to the stage that really happened</h2></div><small>{(referrals || []).length} total</small></div>
      <div className={styles.columns}>
        {groups.map(([kind, label]) => {
          const list = (referrals || []).filter((r) => r.kind === kind);
          return (
            <div className={styles.column} key={kind}>
              <h3>{label} <span>{list.length}</span></h3>
              {list.length === 0 ? <div className={styles.emptySmall}>None yet</div> : list.map((r) => {
                const e = edits[r.id] || {};
                return (
                  <article key={r.id} className={r.stage === 'duplicate_hold' ? styles.introHold : styles.intro}>
                    <strong>{r.target_reference}</strong>
                    <small>From {r.member_name} ({r.member_code}){r.service_category ? ` · ${pretty(r.service_category)}` : ''}</small>
                    <select value={e.stage ?? r.stage} onChange={(ev) => setEdits({ ...edits, [r.id]: { ...e, stage: ev.target.value } })}>
                      {STAGES_BY_KIND[kind].map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}
                    </select>
                    <input placeholder="Owner" list="network-owners" value={e.owner ?? r.owner ?? ''} onChange={(ev) => setEdits({ ...edits, [r.id]: { ...e, owner: ev.target.value } })} />
                    <input placeholder="What happened" value={e.note ?? r.outcome_note ?? ''} onChange={(ev) => setEdits({ ...edits, [r.id]: { ...e, note: ev.target.value } })} />
                    <button className={styles.save} disabled={busy === r.id} onClick={() => act(r.id, 'sos_ops_network_update_referral', { p_referral_id: r.id, p_stage: e.stage ?? r.stage, p_owner: e.owner ?? r.owner ?? null, p_note: e.note ?? null }, 'Introduction updated.')}>Save</button>
                  </article>
                );
              })}
            </div>
          );
        })}
      </div>
      <datalist id="network-owners">{OWNERS.map((o) => <option key={o} value={o} />)}</datalist>
    </section>
  );
}

function Founding({ slots, territories, busy, act }) {
  const [wave, setWave] = useState(1);
  const [edits, setEdits] = useState({});
  const list = (slots || []).filter((s) => s.wave === wave);
  const byWave = useMemo(() => [1, 2, 3, 4].map((w) => (slots || []).filter((s) => s.wave === w && s.invitation_status !== 'not_selected').length), [slots]);
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span className={styles.kicker}>FOUNDING 100</span><h2>Four waves of 25 — real people only</h2></div></div>
      <p className={styles.muted}>Pick a real person, confirm they’re okay being invited, then mark <b>Approved to invite</b> to create their invite code. Invites go out by hand from your own phone. One follow-up at most.</p>
      <div className={styles.tabs}>
        {[1, 2, 3, 4].map((w) => <button key={w} className={wave === w ? styles.tabOn : styles.tab} onClick={() => setWave(w)}>Wave {w} <b>{byWave[w - 1]}/25 picked</b></button>)}
      </div>
      <div className={styles.slotGrid}>
        {list.map((s) => {
          const e = edits[s.id] || {};
          const v = (k) => (e[k] ?? s[k] ?? '');
          const set = (k, val) => setEdits({ ...edits, [s.id]: { ...e, [k]: val } });
          return (
            <article key={s.id} className={s.member_code ? styles.slotJoined : styles.slot}>
              <div className={styles.slotTop}><span>{s.id.replace('F100-', 'FOUNDING #')}</span><em>{SLOT_LABEL[s.invitation_status]}</em></div>
              <small className={styles.cohort}>{s.cohort}</small>
              <input placeholder="Full name" value={v('full_name')} onChange={(ev) => set('full_name', ev.target.value)} />
              <div className={styles.inline}>
                <select value={v('contact_channel')} onChange={(ev) => set('contact_channel', ev.target.value)}><option value="">Channel</option><option value="text">Text</option><option value="email">Email</option><option value="instagram">Instagram</option><option value="in_person">In person</option></select>
                <input placeholder="Phone, email or handle" value={v('contact_detail')} onChange={(ev) => set('contact_detail', ev.target.value)} />
              </div>
              <div className={styles.inline}>
                <select value={v('territory_id')} onChange={(ev) => set('territory_id', ev.target.value)}><option value="">Side of town</option>{(territories || []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                <input placeholder="Owner" list="network-owners" value={v('owner')} onChange={(ev) => set('owner', ev.target.value)} />
              </div>
              <select value={v('invitation_status')} disabled={Boolean(s.member_code)} onChange={(ev) => set('invitation_status', ev.target.value)}>{SLOT_STATUS.filter(([k]) => k !== 'opted_in' || s.member_code).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              {s.invite_code && <div className={styles.invite}>Invite code <b>{s.invite_code}</b></div>}
              {s.member_code && <div className={styles.joined}>Joined as {s.member_code}</div>}
              <small className={styles.next}>Next: {s.next_action}</small>
              {!s.member_code && <button className={styles.save} disabled={busy === s.id} onClick={() => act(s.id, 'sos_ops_network_update_slot', { p_slot_id: s.id, p_full_name: v('full_name'), p_contact_channel: v('contact_channel'), p_contact_detail: v('contact_detail'), p_territory: v('territory_id'), p_owner: v('owner'), p_status: v('invitation_status'), p_notes: null }, `${s.id.replace('F100-', 'Founding #')} saved.`).then((ok) => { if (ok) setEdits((x) => { const n = { ...x }; delete n[s.id]; return n; }); })}>Save</button>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Territories({ territories }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span className={styles.kicker}>SIDES OF TOWN</span><h2>Eight territories · 1 captain, 4 leads, 20 members each</h2></div></div>
      <div className={styles.territoryGrid}>
        {(territories || []).map((t) => {
          const pct = Math.min(100, Math.round((t.members / Math.max(1, t.member_target)) * 100));
          return (
            <article key={t.id} className={styles.territory}>
              <strong>{t.label}</strong><small>{t.hint}</small>
              <div className={styles.terrNums}><span><b>{t.members}</b> members</span><span><b>{t.founding}</b> founding picked</span></div>
              <div className={styles.bar}><i style={{ width: `${pct}%` }} /></div>
              <small>{t.members} of {t.member_target} members</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Members({ members, busy, act }) {
  const [adjust, setAdjust] = useState({ code: '', delta: '', reason: '' });
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span className={styles.kicker}>MEMBERS</span><h2>Everyone in the network</h2></div><small>{(members || []).length} total</small></div>
      {(members || []).length === 0 ? <div className={styles.empty}>No members yet. The first Founding invite code that gets used shows up here.</div> : (
        <div className={styles.memberTable}>
          <div className={styles.memberHead}><span>Member</span><span>Side of town</span><span>Rank</span><span>Points</span><span>Lanes</span></div>
          {members.map((m) => (
            <div className={styles.memberRow} key={m.member_code}>
              <span><b>{m.display_name}</b><small>{m.member_code}{m.founding_slot ? ` · ${m.founding_slot.replace('F100-', 'Founding #')}` : ''}{m.is_test ? ' · Test account' : ''}{m.referred_by ? ` · Invited by ${m.referred_by}` : ''}</small></span>
              <span>{m.territory}</span><span>{m.rank}</span><span>{Number(m.points).toLocaleString()}</span><span>{(m.divisions || []).map(pretty).join(', ')}</span>
            </div>
          ))}
        </div>
      )}
      <div className={styles.adjust}>
        <h3>Point correction</h3>
        <p className={styles.muted}>Corrections add a new line with your reason; nothing is ever erased. You can’t correct your own points.</p>
        <div className={styles.inline3}>
          <input placeholder="Member number (SOS-0001)" value={adjust.code} onChange={(e) => setAdjust({ ...adjust, code: e.target.value })} />
          <input placeholder="Points (+ or −)" inputMode="numeric" value={adjust.delta} onChange={(e) => setAdjust({ ...adjust, delta: e.target.value })} />
          <input placeholder="Reason" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} />
          <button className={styles.save} disabled={busy === 'adjust' || !adjust.code || !adjust.delta} onClick={() => act('adjust', 'sos_ops_network_adjust_points', { p_member_code: adjust.code, p_delta: parseInt(adjust.delta, 10), p_reason: adjust.reason }, 'Correction recorded.').then((ok) => ok && setAdjust({ code: '', delta: '', reason: '' }))}>Record correction</button>
        </div>
      </div>
    </section>
  );
}

function Recent({ decisions }) {
  if (!(decisions || []).length) return null;
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span className={styles.kicker}>RECENT DECISIONS</span><h2>Last 40 reviews</h2></div></div>
      <div className={styles.memberTable}>
        {decisions.map((d) => (
          <div className={styles.decisionRow} key={d.id}>
            <span><b>{d.mission}</b><small>{d.member_name} · {d.member_code} · {new Date(d.decided_at).toLocaleString()}</small></span>
            <span className={d.status === 'approved' ? styles.good : styles.bad}>{d.status === 'approved' ? `Approved +${d.points_awarded}` : 'Rejected'}</span>
            {d.reviewer_note && <small className={styles.full}>{d.reviewer_note}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}
