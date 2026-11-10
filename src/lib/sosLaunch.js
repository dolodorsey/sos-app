// S.O.S. launch scope — single source of truth for the client.
// The database enforces the same rules (sos_subcategories.is_bookable,
// sos_service_markets, trigger sos_missions_enforce_launch_scope); this file
// keeps the UI consistent even before that column is readable.

export const LAUNCH_MARKET = { id: 'atl', name: 'Metro Atlanta', short: 'Atlanta' };

// Mirrors public.sos_service_markets row 'atl'.
export const LAUNCH_BOUNDS = { minLat: 33.30, maxLat: 34.30, minLng: -84.90, maxLng: -83.80 };

export function inLaunchMarket(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= LAUNCH_BOUNDS.minLat && lat <= LAUNCH_BOUNDS.maxLat && lng >= LAUNCH_BOUNDS.minLng && lng <= LAUNCH_BOUNDS.maxLng;
}

export const OUT_OF_MARKET_MESSAGE = 'S.O.S. is live in metro Atlanta only right now. We are not dispatching to your location yet.';

// Order = order shown in Quick Rescue.
export const LAUNCH_SERVICES = [
  { id: 'tow', name: 'Towing', short: 'Tow', price: 75 },
  { id: 'fuel', name: 'Fuel Delivery', short: 'Gas', price: 55 },
  { id: 'jump', name: 'Jump Start', short: 'Jump', price: 45 },
  { id: 'flat', name: 'Flat Tire Help', short: 'Flat Tire', price: 55 },
  { id: 'lockout', name: 'Lockout', short: 'Lockout', price: 50 },
];

export const SHIELD_ENABLED = false;

export const NOT_AVAILABLE_LABEL = 'Not available yet';

const ids = new Set(LAUNCH_SERVICES.map(service => service.id));
const names = new Set(LAUNCH_SERVICES.map(service => service.name.toLowerCase()));
// Legacy/short names used by older screens.
const aliases = new Set(['flat tire', 'fuel', 'tow', 'gas', 'jump', 'lock out']);

export function isLaunchService(service) {
  if (!service) return false;
  if (typeof service === 'string') {
    const key = service.trim().toLowerCase();
    return ids.has(key) || names.has(key) || aliases.has(key);
  }
  if (typeof service.is_bookable === 'boolean') return service.is_bookable;
  if (service.id && ids.has(String(service.id))) return true;
  return isLaunchService(String(service.name || ''));
}

export function launchServiceId(name) {
  const key = String(name || '').trim().toLowerCase();
  const match = LAUNCH_SERVICES.find(service => service.name.toLowerCase() === key || service.short.toLowerCase() === key || service.id === key);
  if (match) return match.id;
  if (key === 'flat tire') return 'flat';
  if (key === 'fuel') return 'fuel';
  return null;
}

export const LAUNCH_SERVICE_LIST_TEXT = 'Towing, Fuel Delivery, Jump Start, Flat Tire Help and Lockout';

export function notAvailableMessage(name) {
  return `${name || 'This service'} is not available yet. At launch S.O.S. offers ${LAUNCH_SERVICE_LIST_TEXT} in ${LAUNCH_MARKET.name}.`;
}
