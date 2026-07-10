import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'S.O.S requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const sosSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const throwOnError = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export async function dispatchMission(
  missionId,
  { radiusMiles = 15, offerTtlSeconds = 45 } = {}
) {
  return throwOnError(
    await sosSupabase.rpc('sos_dispatch_mission', {
      p_mission_id: missionId,
      p_radius_miles: radiusMiles,
      p_offer_ttl_seconds: offerTtlSeconds,
    })
  );
}

export async function acceptMissionOffer(offerId) {
  const missions = throwOnError(
    await sosSupabase.rpc('sos_accept_mission_offer', {
      p_offer_id: offerId,
    })
  );
  return missions?.[0] ?? null;
}

export async function declineMissionOffer(offerId, reason = null) {
  return throwOnError(
    await sosSupabase.rpc('sos_decline_mission_offer', {
      p_offer_id: offerId,
      p_reason: reason,
    })
  );
}

export async function getOpenHeroOffers() {
  return throwOnError(
    await sosSupabase
      .from('sos_mission_offers')
      .select(
        'id, mission_id, distance_miles, eta_minutes, payout_amount, status, offered_at, expires_at, sos_missions(id, request_type, pickup_address, category_id, subcategory_id, estimated_price, citizen_notes)'
      )
      .eq('status', 'offered')
      .gt('expires_at', new Date().toISOString())
      .order('offered_at', { ascending: false })
  );
}

export async function updateHeroLocation({ heroId, lat, lng }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new TypeError('A valid latitude and longitude are required.');
  }

  return throwOnError(
    await sosSupabase
      .from('sos_heroes')
      .update({
        last_lat: lat,
        last_lng: lng,
        last_gps_at: new Date().toISOString(),
      })
      .eq('id', heroId)
      .select('id, last_lat, last_lng, last_gps_at')
      .single()
  );
}

export async function getMissionTimeline(missionId) {
  return throwOnError(
    await sosSupabase
      .from('sos_mission_events')
      .select('id, event_type, old_status, new_status, payload, lat, lng, actor, created_at')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: true })
  );
}

export function subscribeToMission(missionId, onChange) {
  const channel = sosSupabase
    .channel(`sos-mission-${missionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sos_missions',
        filter: `id=eq.${missionId}`,
      },
      onChange
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'sos_mission_events',
        filter: `mission_id=eq.${missionId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    sosSupabase.removeChannel(channel);
  };
}
