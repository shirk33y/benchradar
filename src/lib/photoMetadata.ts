import * as exifr from "exifr";
import type { LatLngTuple } from "leaflet";

type ParsedGpsMetadata = {
  latitude?: number;
  longitude?: number;
  GPSLatitude?: number[];
  GPSLongitude?: number[];
  GPSLatitudeRef?: string;
  GPSLongitudeRef?: string;
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function dmsToDecimal(value: unknown, ref?: unknown): number | null {
  if (Array.isArray(value) && value.length > 0) {
    const [degRaw, minRaw = 0, secRaw = 0] = value as number[];
    if (typeof degRaw !== "number") {
      return null;
    }
    const min = typeof minRaw === "number" ? minRaw : 0;
    const sec = typeof secRaw === "number" ? secRaw : 0;
    let decimal = degRaw + min / 60 + sec / 3600;
    if (
      typeof ref === "string" &&
      (ref.toUpperCase() === "S" || ref.toUpperCase() === "W")
    ) {
      decimal *= -1;
    }
    return decimal;
  }

  if (isNumber(value)) {
    let decimal = value;
    if (
      typeof ref === "string" &&
      (ref.toUpperCase() === "S" || ref.toUpperCase() === "W")
    ) {
      decimal *= -1;
    }
    return decimal;
  }

  return null;
}

async function tryExtractGpsFromFile(file: File): Promise<LatLngTuple | null> {
  try {
    const gps = await exifr.gps(file);
    if (gps && isNumber(gps.latitude) && isNumber(gps.longitude)) {
      return [gps.latitude, gps.longitude];
    }
  } catch (_err) {
    // eslint-disable-next-line no-console
    console.error(_err);
    // ignore and try fallback parsing
  }

  try {
    const parsed = (await exifr.parse(file, {
      pick: [
        "latitude",
        "longitude",
        "GPSLatitude",
        "GPSLongitude",
        "GPSLatitudeRef",
        "GPSLongitudeRef",
      ],
    })) as ParsedGpsMetadata | undefined | null;

    if (!parsed) return null;

    const lat =
      isNumber(parsed.latitude)
        ? parsed.latitude
        : dmsToDecimal(parsed.GPSLatitude, parsed.GPSLatitudeRef);
    const lng =
      isNumber(parsed.longitude)
        ? parsed.longitude
        : dmsToDecimal(parsed.GPSLongitude, parsed.GPSLongitudeRef);

    if (isNumber(lat) && isNumber(lng)) {
      return [lat, lng];
    }
  } catch (_err) {
    // eslint-disable-next-line no-console
    console.error(_err);
    // no-op; fall back to manual selection
  }

  return null;
}

export async function extractGpsFromFiles(
  files: File[]
): Promise<LatLngTuple | null> {
  for (const file of files) {
    const coords = await tryExtractGpsFromFile(file);
    if (coords) {
      return coords;
    }
  }
  return null;
}
