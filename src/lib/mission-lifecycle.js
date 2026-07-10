import { sosSupabase } from './dispatch';

export async function advanceMissionStatus({
  missionId,
  status,
  lat = null,
  lng = null,
  payload = {},
}) {
  const { data, error } = await sosSupabase.rpc('sos_advance_mission_status', {
    p_mission_id: missionId,
    p_new_status: status,
    p_lat: lat,
    p_lng: lng,
    p_payload: payload,
  });
  if (error) throw error;
  return data;
}

export async function cancelMission(missionId, reason) {
  const { data, error } = await sosSupabase.rpc('sos_cancel_mission', {
    p_mission_id: missionId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}
