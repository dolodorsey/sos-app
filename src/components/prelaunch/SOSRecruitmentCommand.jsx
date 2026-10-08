'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { sosRpc } from '@/lib/sosPrelaunch';

// Internal S.O.S. recruitment command. Every number here comes from operator-only
// SECURITY DEFINER RPCs; demo fixtures and test signups are excluded from real counts.
// Actions record audit events. Nothing here sends email/SMS — Muse owns approved sends.

const STATUSES = ['interested', 'contact_verified', 'screening', 'invited_to_apply', 'not_a_fit', 'withdrawn'];
const METRICS = [
  ['i', 'Interested'], ['sc', 'Screening'], ['v', 'Verified'], ['od', 'On duty'], ['p', 'Prospects'],
];
const pretty = (v) => String(v || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const token = () => {
  try { return JSON.parse(localStorage.getItem('sos_ops_session') || 'null')?.access_token || null; } catch { return null; }
};
const rpc = (name, body = {}) => sosRpc(name, body, token());

export default function SOSRecruitmentCommand() {
  const [dash, setDash] = useState(null);
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('matrix');
  const [metric, setMetric] = useState('i');
  const [zoneFilter, setZoneFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [includeTest, setIncludeTest] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [queueZone, setQueueZone] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState('');
  const [action, setAction] = useState({ status: '', evidence: '', owner: '', note: '' });

  const load = useCallback(async () => {
    setError('');
    try {
      const [d, q] = await Promise.all([rpc('sos_ops_recruitment_dashboard'), rpc('sos_ops_early_interest_queue', { p_include_test: includeTest, p_limit: 500 })]);
      setDash(d); setQueue(Array.isArray(q) ? q : []);
    } catch (e) { setError(e.message); }
  }, [includeTest]);
  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => queue.find((x) => x.candidate_id === selectedId) || null, [queue, selectedId]);
  useEffect(() => {
    if (!selectedId) { setEvents([]); return; }
    rpc('sos_ops_early_interest_events', { p_candidate_id: selectedId }).then((e) => setEvents(Array.isArray(e) ? e : [])).catch(() => setEvents([]));
    const s = queue.find((x) => x.candidate_id === selectedId);
    setAction({ status: s?.interest_status || '', evidence: '', owner: s?.assigned_owner || '', note: '' });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cellMap = useMemo(() => {
    const m = new Map();
    (dash?.matrix || []).forEach((c) => m.set(`${c.z}|${c.s}`, c));
    return m;
  }, [dash]);

  const zones = (dash?.zones || []).filter((z) => !zoneFilter || z.id === zoneFilter);
  const categories = (dash?.categories || []).filter((c) => !catFilter || c.id === catFilter);
  const allSubs = useMemo(() => (dash?.categories || []).flatMap((c) => c.subcategories), [dash]);

  const filteredQueue = useMemo(() => queue.filter((x) =>
    (!statusFilter || x.interest_status === statusFilter)
    && (!serviceFilter || (x.services || []).some((s) => s.id === serviceFilter))
    && (!queueZone || (x.zones || []).some((z) => z.id === queueZone))), [queue, statusFilter, serviceFilter, queueZone]);

  const run = async (label, fn, okMessage) => {
    setBusy(label); setError(''); setNotice('');
    try { await fn(); setNotice(okMessage); await load(); if (selectedId) setEvents(await rpc('sos_ops_early_interest_events', { p_candidate_id: selectedId })); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const saveStatus = () => run('status', () => rpc('sos_ops_update_early_interest', {
    p_candidate_id: selected.candidate_id, p_interest_status: action.status, p_contact_evidence: action.evidence || null, p_note: action.note || null,
  }), `Status set to ${pretty(action.status)}.${action.status === 'invited_to_apply' ? ' A full-application invitation is now on file for this email. No message was sent.' : ''}`);
  const saveOwner = () => run('owner', () => rpc('sos_ops_update_early_interest', { p_candidate_id: selected.candidate_id, p_assigned_owner: action.owner }), 'Owner updated.');
  const setTag = (tag) => run('tag', () => rpc('sos_ops_update_early_interest', { p_candidate_id: selected.candidate_id, p_muse_outreach_tag: tag }),
    tag === 'none' ? 'Muse tag removed.' : 'Tagged for Muse review. No message was sent — Muse owns approved sends.');
  const addNote = () => run('note', () => rpc('sos_ops_update_early_interest', { p_candidate_id: selected.candidate_id, p_note: action.note }), 'Note added.');
  const erase = () => {
    const reason = window.prompt('Privacy erasure removes this provider’s personal details and suppresses all contact. Enter the request reason:');
    if (!reason) return;
    run('erase', () => rpc('sos_ops_erase_provider_interest', { p_candidate_id: selected.candidate_id, p_reason: reason }), 'Personal details erased and contact suppressed.');
  };

  const signOut = () => { try { localStorage.removeItem('sos_ops_session'); } catch {} window.location.assign('/ops/'); };
  const t = dash?.totals || {};

  return (
    <div className="pl-ops">
      <header className="pl-header">
        <a href="/ops/" className="pl-brand"><img src="/brand/prelaunch/sos-mark-180.png" alt="" width="40" height="38" /><span><strong>S.O.S.</strong><small>Recruitment command · internal</small></span></a>
        <button type="button" className="pl-btn pl-btn-ghost pl-btn-small" onClick={load}>Refresh</button>
        <button type="button" className="pl-btn pl-btn-ghost pl-btn-small" onClick={signOut}>Sign out</button>
      </header>
      <main className="pl-ops-main">
        <h1 className="pl-h2">Provider supply by service and zone</h1>
        <p className="pl-sub">Pre-launch is {dash ? (dash.prelaunch ? 'ON — the marketplace is closed to the public' : 'OFF') : '…'}. Prospects, early interest and verified Heroes are counted separately. Demo fixtures and test signups never count.</p>
        {error && <div className="pl-alert" role="alert">{error}</div>}
        {notice && <div className="pl-notice" role="status">{notice}</div>}

        <div className="pl-ops-totals">
          {[
            ['interested', 'Early interest'], ['reachable', 'Reachable (opted in)'], ['contact_verified', 'Contact verified'], ['screening', 'Screening'],
            ['invited_to_apply', 'Invited to apply'], ['full_applications', 'Full applications'], ['verified', 'Verified Heroes'], ['on_duty', 'On duty'],
            ['prospects', 'Prospects (not providers)'], ['excluded_test_signups', 'Test signups excluded'],
          ].map(([k, label]) => <div key={k} className="pl-ops-total"><strong>{dash ? (t[k] ?? 0) : '—'}</strong><span>{label}</span></div>)}
        </div>
        {dash && <p className="pl-field-hint">Verified coverage: {t.covered_cells_verified} of {t.total_cells} service × zone cells. Excluded demo records: {t.excluded_demo_candidates} candidates, {t.excluded_demo_heroes} Hero profiles.</p>}

        <div className="pl-ops-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'matrix'} onClick={() => setTab('matrix')}>Supply matrix</button>
          <button role="tab" aria-selected={tab === 'queue'} onClick={() => setTab('queue')}>Early interest ({queue.length})</button>
        </div>

        {tab === 'matrix' && (
          <section aria-label="Supply matrix">
            <div className="pl-ops-controls">
              <label className="pl-field"><span>Show</span>
                <select value={metric} onChange={(e) => setMetric(e.target.value)}>
                  {METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  <option value="all">Interested / Screening / Verified</option>
                </select>
              </label>
              <label className="pl-field"><span>Zone</span>
                <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}><option value="">All zones</option>{(dash?.zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
              </label>
              <label className="pl-field"><span>Category</span>
                <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}><option value="">All categories</option>{(dash?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </label>
            </div>
            <div className="pl-ops-legend"><span className="k-p">Prospect</span><span className="k-i">Interested</span><span className="k-s">Screening</span><span className="k-v">Verified</span></div>
            <div className="pl-matrix-wrap">
              <table className="pl-matrix">
                <thead><tr><th scope="col">Service</th>{zones.map((z) => <th key={z.id} scope="col">{z.name}</th>)}</tr></thead>
                <tbody>
                  {categories.map((c) => [
                    <tr key={`c-${c.id}`} className="pl-cat-row"><th colSpan={zones.length + 1} scope="rowgroup">{c.name}</th></tr>,
                    ...c.subcategories.map((s) => (
                      <tr key={s.id}>
                        <th scope="row">{s.name}</th>
                        {zones.map((z) => {
                          const cell = cellMap.get(`${z.id}|${s.id}`) || {};
                          const cls = cell.v ? 'pl-cell-v' : cell.sc ? 'pl-cell-s' : cell.i ? 'pl-cell-i' : '';
                          const value = metric === 'all' ? `${cell.i || 0} / ${cell.sc || 0} / ${cell.v || 0}` : (cell[metric] || 0);
                          const zero = metric === 'all' ? !(cell.i || cell.sc || cell.v) : !cell[metric];
                          return <td key={z.id} className={`${cls} ${zero ? 'pl-cell-zero' : ''}`} title={`Prospects ${cell.p || 0} · Interested ${cell.i || 0} · Screening ${cell.sc || 0} · Verified ${cell.v || 0} · On duty ${cell.od || 0}`}>{value}</td>;
                        })}
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'queue' && (
          <section aria-label="Early interest queue">
            <div className="pl-ops-controls">
              <label className="pl-field"><span>Status</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}</select>
              </label>
              <label className="pl-field"><span>Service</span>
                <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}><option value="">All services</option>{allSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </label>
              <label className="pl-field"><span>Zone</span>
                <select value={queueZone} onChange={(e) => setQueueZone(e.target.value)}><option value="">All zones</option>{(dash?.zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
              </label>
              <label className="pl-consent"><input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />Show test signups</label>
            </div>
            <div className="pl-ops-work">
              <div className="pl-ops-list">
                {filteredQueue.length === 0 && <p className="pl-sub">No early-interest registrations match these filters.</p>}
                {filteredQueue.map((x) => (
                  <button key={x.candidate_id} type="button" className="pl-ops-item" aria-current={x.candidate_id === selectedId} onClick={() => setSelectedId(x.candidate_id)}>
                    <strong>{x.company_name || [x.first_name, x.last_name].filter(Boolean).join(' ') || 'Provider'}</strong>
                    <small>{pretty(x.provider_type)} · {x.city}, {x.state_code} · {(x.services || []).length} services · {(x.zones || []).length} zones · {x.latest_receipt_number}</small>
                    <span className="pl-ops-badges">
                      <span className="pl-badge">{pretty(x.interest_status)}</span>
                      {x.is_test && <span className="pl-badge pl-badge-test">Test</span>}
                      {x.matched_existing_record && <span className="pl-badge">Matched existing record</span>}
                      {(x.email_opt_in || x.sms_opt_in) && <span className="pl-badge pl-badge-ok">Opted in</span>}
                      {x.do_not_contact && <span className="pl-badge pl-badge-warn">Do not contact</span>}
                      {x.muse_outreach_tag !== 'none' && <span className="pl-badge">Muse review</span>}
                    </span>
                  </button>
                ))}
              </div>
              <aside className="pl-ops-detail" aria-label="Selected provider">
                {!selected ? <p className="pl-sub">Select a registration to work it.</p> : (
                  <>
                    <h2>{selected.company_name || [selected.first_name, selected.last_name].filter(Boolean).join(' ')}</h2>
                    <dl>
                      <dt>Contact</dt><dd>{selected.first_name} {selected.last_name} · {selected.email || 'no email'} · {selected.phone || 'no phone'}</dd>
                      <dt>Opt-ins</dt><dd>Email {selected.email_opt_in ? 'yes' : 'no'} · SMS {selected.sms_opt_in ? 'yes' : 'no'}</dd>
                      <dt>Location</dt><dd>{selected.city}, {selected.state_code} {selected.zip_code}{selected.service_radius_miles ? ` · ${selected.service_radius_miles} mi radius` : ''}</dd>
                      <dt>Status</dt><dd>{pretty(selected.interest_status)} since {new Date(selected.status_entered_at).toLocaleDateString()}</dd>
                      <dt>Registered</dt><dd>{new Date(selected.first_registered_at).toLocaleString()} · {selected.submission_count} submission(s)</dd>
                      <dt>Source</dt><dd>{pretty(selected.candidate_source)}{selected.latest_attribution?.utm_source ? ` · ${selected.latest_attribution.utm_source}` : ''}</dd>
                      <dt>Experience</dt><dd>{selected.years_experience ?? '—'} yrs · {(selected.availability || []).map(pretty).join(', ') || 'no availability given'}</dd>
                      <dt>Equipment</dt><dd>{selected.equipment_notes || '—'}</dd>
                      <dt>Services</dt><dd>{(selected.services || []).map((s) => s.name).join(', ')} <em className="pl-field-hint">(self-reported)</em></dd>
                      <dt>Zones</dt><dd>{(selected.zones || []).map((z) => `${z.name}${z.verified ? ' ✓' : ''}`).join(', ')} <em className="pl-field-hint">(self-reported unless ✓)</em></dd>
                    </dl>
                    <div className="pl-ops-controls">
                      <label className="pl-field"><span>Stage</span>
                        <select value={action.status} onChange={(e) => setAction((a) => ({ ...a, status: e.target.value }))}>{STATUSES.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}</select>
                      </label>
                    </div>
                    {action.status === 'contact_verified' && action.status !== selected.interest_status && (
                      <label className="pl-field"><span>How was the contact verified?</span>
                        <textarea value={action.evidence} onChange={(e) => setAction((a) => ({ ...a, evidence: e.target.value }))} placeholder="e.g. Provider replied from the registered email on Oct 9; confirmed services by phone." />
                      </label>
                    )}
                    <label className="pl-field"><span>Note (optional)</span>
                      <textarea value={action.note} onChange={(e) => setAction((a) => ({ ...a, note: e.target.value }))} />
                    </label>
                    <div className="pl-actions">
                      <button type="button" className="pl-btn pl-btn-primary pl-btn-small" disabled={Boolean(busy) || action.status === selected.interest_status} onClick={saveStatus}>{busy === 'status' ? 'Saving…' : 'Change stage'}</button>
                      <button type="button" className="pl-btn pl-btn-ghost pl-btn-small" disabled={Boolean(busy) || !action.note.trim()} onClick={addNote}>Add note</button>
                    </div>
                    <div className="pl-ops-controls">
                      <label className="pl-field"><span>Assigned owner</span>
                        <input value={action.owner} onChange={(e) => setAction((a) => ({ ...a, owner: e.target.value }))} maxLength={120} />
                      </label>
                      <button type="button" className="pl-btn pl-btn-ghost pl-btn-small" disabled={Boolean(busy)} onClick={saveOwner}>Save owner</button>
                    </div>
                    <div className="pl-actions">
                      {selected.muse_outreach_tag === 'none'
                        ? <button type="button" className="pl-btn pl-btn-ghost pl-btn-small" disabled={Boolean(busy)} onClick={() => setTag('tagged_for_muse_review')}>Tag for Muse outreach review</button>
                        : <button type="button" className="pl-btn pl-btn-ghost pl-btn-small" disabled={Boolean(busy)} onClick={() => setTag('none')}>Remove Muse tag</button>}
                      <button type="button" className="pl-btn pl-btn-ghost pl-btn-small" disabled={Boolean(busy)} onClick={erase}>Privacy erasure</button>
                    </div>
                    <p className="pl-field-hint">Stage changes and tags are recorded with your operator identity. No email, SMS or DM is sent from this screen.</p>
                    <h3 className="pl-h3" style={{ fontSize: 20, marginTop: 20 }}>History</h3>
                    <ul style={{ paddingLeft: 18, fontSize: 14, color: '#cfd6df' }}>
                      {events.map((ev, i) => <li key={i}>{new Date(ev.at).toLocaleString()} — {pretty(ev.event_type)}{ev.to ? ` → ${pretty(ev.to)}` : ''} ({ev.actor}){ev.detail?.note ? `: ${ev.detail.note}` : ''}</li>)}
                    </ul>
                  </>
                )}
              </aside>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
