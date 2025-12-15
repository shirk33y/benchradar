export const LAT_LNG_HINT = "Enter coordinates like 54.647800,-2.150950";

export function parseLatLngInput(value: string): [number, number] | null {
  const normalized = value
    .replace(/[^\d.,\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const parts = normalized.split(/[, ]+/).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);

  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return [lat, lng];
}

export function formatLatLngInput(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function validateLatLngInput(value: string): string | null {
  if (!value.trim()) {
    return LAT_LNG_HINT;
  }
  return parseLatLngInput(value)
    ? null
    : "Coordinates must be valid lat,lng values";
}

export function parseAndFormatLatLngInput(value: string):
  | { lat: number; lng: number; formatted: string }
  | null {
  const parsed = parseLatLngInput(value);
  if (!parsed) return null;
  const [lat, lng] = parsed;
  return {
    lat,
    lng,
    formatted: formatLatLngInput(lat, lng),
  };
}
