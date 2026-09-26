/** Service-area check. Geocoding happens outside this module. */

export type ServiceArea = {
  mode: "off" | "radius" | "zips";
  radiusMiles?: number | null;
  center?: { lat: number; lng: number } | null;
  zips?: string[];
};

export type PlacePoint = {
  lat: number;
  lng: number;
  postalCode?: string | null;
};

export type AreaDecision = { ok: true; reason: string } | { ok: false; reason: string };

const EARTH_MILES = 3958.8;

export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function normalizeZip(value: string): string {
  return value.trim().slice(0, 5);
}

/** Accept a job address only when it falls inside the line's service area. */
export function decideServiceArea(area: ServiceArea, place: PlacePoint | null): AreaDecision {
  if (area.mode === "off") return { ok: true, reason: "Service area check is off." };
  if (!place) {
    return { ok: false, reason: "That address could not be verified on the map." };
  }

  if (area.mode === "zips") {
    const allowed = (area.zips ?? []).map(normalizeZip).filter((zip) => /^\d{5}$/.test(zip));
    const zip = place.postalCode ? normalizeZip(place.postalCode) : "";
    if (!zip || !allowed.includes(zip)) {
      return { ok: false, reason: "That address is outside the service area." };
    }
    return { ok: true, reason: `ZIP ${zip} is in the service area.` };
  }

  const center = area.center;
  const radius = area.radiusMiles ?? 0;
  if (!center || radius <= 0) {
    return { ok: false, reason: "The service-area radius is not set up yet." };
  }
  const miles = haversineMiles(center, place);
  if (miles > radius) {
    return {
      ok: false,
      reason: `That address is ${miles.toFixed(1)} miles away, outside the ${radius}-mile service area.`,
    };
  }
  return { ok: true, reason: `Inside the service area (${miles.toFixed(1)} miles).` };
}
