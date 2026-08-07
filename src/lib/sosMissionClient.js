const SOS_URL = 'https://cxdqkjvtpilvouwtbgdy.supabase.co'
const SOS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZHFranZ0cGlsdm91d3RiZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTg4MzgsImV4cCI6MjA4NzA3NDgzOH0.pIOX5kzkY6X-lpQjrGkQN7BWSMQSUFVVIvyZ2RA31-4'

const headers = token => ({
  apikey: SOS_KEY,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

const parse = async response => {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || payload?.error || 'Request failed')
  return payload
}

export async function requestCustomerMission({ token, serviceName, serviceId, location, notes = null }) {
  if (!token) throw new Error('Please sign in to request a Hero.')
  if (location?.lat == null || location?.lng == null) throw new Error('Location permission is required for roadside dispatch.')

  const response = await fetch(`${SOS_URL}/functions/v1/request-customer-mission`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      service_name: serviceName,
      service_id: serviceId || undefined,
      pickup_lat: location.lat,
      pickup_lng: location.lng,
      pickup_address: location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
      request_type: 'now',
      notes,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok && !payload?.mission?.id) throw new Error(payload?.error || 'Your roadside request could not be created.')
  return payload
}

export async function getCustomerMission(token, missionId) {
  if (!token || !missionId) return null
  const select = [
    'id,status,pickup_lat,pickup_lng,pickup_address,estimated_price,final_price,pricing_status,requested_service_name,eta_minutes,hero_id,created_at,matched_at,accepted_at,en_route_at,arrived_at,started_at,completed_at,canceled_at',
    'hero:sos_heroes!sos_missions_hero_id_fkey(id,rating,level,user:sos_users!sos_heroes_user_id_fkey(first_name,last_name,avatar_url))',
    'offers:sos_mission_offers(id,status,eta_minutes,expires_at)',
    'payments:sos_payments(payment_status,escrow_status,amount)',
    'ratings:sos_ratings(id,rating,review_text,created_at)',
  ].join(',')
  const response = await fetch(`${SOS_URL}/rest/v1/sos_missions?id=eq.${encodeURIComponent(missionId)}&select=${encodeURIComponent(select)}&limit=1`, {
    headers: headers(token),
  })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload?.message || payload?.error || 'Mission status could not be loaded.')
  return payload?.[0] || null
}

export async function authorizeCustomerMission(token, missionId) {
  const response = await fetch(`${SOS_URL}/functions/v1/create-mission-checkout`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ mission_id: missionId }),
  })
  return parse(response)
}

export async function rateCustomerMission(token, missionId, rating, reviewText = null) {
  const response = await fetch(`${SOS_URL}/rest/v1/rpc/sos_rate_completed_mission`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      p_mission_id: missionId,
      p_rating: rating,
      p_review_text: reviewText,
      p_tags: [],
      p_is_public: true,
    }),
  })
  return parse(response)
}

export async function cancelCustomerMission(token, missionId, reason = 'Customer canceled from app') {
  const response = await fetch(`${SOS_URL}/rest/v1/rpc/sos_cancel_own_mission`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ p_mission_id: missionId, p_reason: reason }),
  })
  return parse(response)
}

export function missionPhase(status) {
  return ({
    requested: 'received',
    matching: 'matching',
    assigned: 'assigned',
    en_route: 'en_route',
    on_site: 'on_site',
    working: 'working',
    completed: 'completed',
    canceled_by_citizen: 'canceled',
    canceled_by_hero: 'canceled',
    canceled_by_system: 'canceled',
    disputed: 'support',
  })[status] || 'received'
}
