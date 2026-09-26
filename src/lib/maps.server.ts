import { connectorConfigured, gatewayRequest } from "./connectors.server";

export function mapsConfigured(): boolean {
  return connectorConfigured("google_maps");
}

export type GeocodeResult = {
  formatted: string;
  lat: number;
  lng: number;
  placeId: string;
};

export async function geocode(address: string): Promise<GeocodeResult | null> {
  const res = await gatewayRequest<{
    status: string;
    results?: Array<{
      formatted_address: string;
      place_id: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  }>({
    connector: "google_maps",
    path: "/maps/api/geocode/json",
    query: { address },
  });
  const first = res.results?.[0];
  if (!first) return null;
  return {
    formatted: first.formatted_address,
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    placeId: first.place_id,
  };
}

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
};

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const res = await gatewayRequest<{
    places?: Array<{
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      internationalPhoneNumber?: string;
    }>;
  }>({
    connector: "google_maps",
    path: "/places/v1/places:searchText",
    method: "POST",
    json: { textQuery: query, maxResultCount: 8 },
    headers: {
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber",
    },
  });
  return (res.places ?? []).map((p) => ({
    id: p.id,
    name: p.displayName?.text ?? "(unnamed)",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    ...(p.internationalPhoneNumber ? { phone: p.internationalPhoneNumber } : {}),
  }));
}

/** Approximate a caller's location from Lookup / area-code data. */
export async function locateCaller(hint: string): Promise<GeocodeResult | null> {
  if (!hint.trim()) return null;
  try {
    return await geocode(hint);
  } catch (error) {
    console.error("locateCaller failed", error);
    return null;
  }
}
