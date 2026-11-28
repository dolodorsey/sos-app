import { sosSupabase } from './sosSupabaseClient';

// THE SIGNAL / Superhero Network client. Every read and write goes through
// database functions that check who is signed in; the browser never sets points.

export const CATEGORY_LABEL = {
  social: 'Social media',
  customer: 'Customers',
  provider: 'Provider recruiting',
  street: 'Street team',
  quality: 'App testing',
};

export const STAGE_LABEL = {
  introduced: 'Introduced',
  registered: 'Signed up',
  activated: 'Activated',
  first_paid_service: 'First paid service',
  retained: 'Came back again',
  applied: 'Applied',
  qualified: 'Qualified',
  approved: 'Approved',
  dispatch_ready: 'Ready for rescues',
  active: 'Active',
  agreed: 'Agreed',
  placed: 'Display placed',
  not_converted: 'Did not convert',
  duplicate_hold: 'On hold: someone else introduced them first',
};

export const STAGES_BY_KIND = {
  customer: ['introduced', 'registered', 'activated', 'first_paid_service', 'retained', 'not_converted', 'duplicate_hold'],
  provider: ['introduced', 'applied', 'qualified', 'approved', 'dispatch_ready', 'active', 'not_converted', 'duplicate_hold'],
  business: ['introduced', 'agreed', 'placed', 'active', 'not_converted', 'duplicate_hold'],
};

export const WEEK = [
  ['Monday', 'Mission Monday', 'New missions go up'],
  ['Tuesday', 'Tag Team Tuesday', 'Referrals'],
  ['Wednesday', 'Word of Mouth Wednesday', 'Customers'],
  ['Thursday', 'Test Pilot Thursday', 'App testing'],
  ['Friday', 'Flash Signal Friday', 'Everyone posts the same approved content'],
  ['Saturday', 'Street Team Saturday', 'Permission-based activations'],
  ['Sunday', 'Superhero Sunday', 'Recognition and the weekly report'],
];

export const pretty = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const friendly = (error) => {
  const msg = error?.message || String(error || 'Something went wrong');
  if (/JWT|jwt|token/i.test(msg)) return 'Your sign-in expired. Sign in again.';
  return msg;
};

export async function networkRpc(name, args = {}) {
  const { data, error } = await sosSupabase.rpc(name, args);
  if (error) throw new Error(friendly(error));
  return data;
}

// Reuse the main S.O.S. app session when the person is already signed in there.
export async function restoreNetworkSession() {
  const { data } = await sosSupabase.auth.getSession();
  if (data?.session) return data.session;
  try {
    const saved = JSON.parse(localStorage.getItem('sos_session') || 'null');
    if (saved?.access_token && saved?.refresh_token) {
      const { data: set } = await sosSupabase.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token });
      if (set?.session) return set.session;
    }
  } catch { /* fall through to sign-in */ }
  return null;
}

export async function networkSignIn(email, password) {
  const { data, error } = await sosSupabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'That email and password do not match an S.O.S. account.' : error.message);
  return data.session;
}

export async function networkSignOut() {
  await sosSupabase.auth.signOut();
}

export function inviteLink(code) {
  return `https://superherosonstandby.com/network?code=${encodeURIComponent(code || '')}`;
}
