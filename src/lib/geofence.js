/**
 * GPS Geofencing utility.
 * Uses the Haversine formula to check if coordinates are within
 * the allowed campus radius. Works on both client and server.
 */

// Campus center — Holy Angel University, Angeles City, Pampanga
const CAMPUS_LAT = parseFloat(process.env.NEXT_PUBLIC_CAMPUS_LAT) || 15.133078;
const CAMPUS_LNG = parseFloat(process.env.NEXT_PUBLIC_CAMPUS_LNG) || 120.590011;
const CAMPUS_RADIUS_METERS = parseFloat(process.env.NEXT_PUBLIC_CAMPUS_RADIUS_METERS) || 200;

/**
 * Calculate distance between two GPS coordinates using the Haversine formula.
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if given coordinates are within the allowed campus radius.
 * @param {number} lat - User's latitude
 * @param {number} lng - User's longitude
 * @returns {{ allowed: boolean, distance: number, maxRadius: number }}
 */
export function isWithinCampus(lat, lng) {
  const distance = haversineDistance(lat, lng, CAMPUS_LAT, CAMPUS_LNG);
  return {
    allowed: distance <= CAMPUS_RADIUS_METERS,
    distance: Math.round(distance),
    maxRadius: CAMPUS_RADIUS_METERS
  };
}

export { CAMPUS_LAT, CAMPUS_LNG, CAMPUS_RADIUS_METERS };
