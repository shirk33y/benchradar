import { describe, expect, it } from "vitest";

import {
  formatLatLngInput,
  LAT_LNG_HINT,
  parseAndFormatLatLngInput,
  parseLatLngInput,
  validateLatLngInput,
} from "./geo";

describe("geo (unit)", () => {
  it("parseLatLngInput parses comma or space separated coordinates", () => {
    expect(parseLatLngInput("54.1,-2.2")).toEqual([54.1, -2.2]);
    expect(parseLatLngInput("54.1 -2.2")).toEqual([54.1, -2.2]);
  });

  it("parseLatLngInput rejects out of range values", () => {
    expect(parseLatLngInput("91,0")).toBe(null);
    expect(parseLatLngInput("0,181")).toBe(null);
  });

  it("formatLatLngInput formats to 6 decimals", () => {
    expect(formatLatLngInput(1.2, 3.4)).toBe("1.200000,3.400000");
  });

  it("validateLatLngInput returns hint on empty", () => {
    expect(validateLatLngInput(" ")).toBe(LAT_LNG_HINT);
  });

  it("validateLatLngInput returns error on invalid", () => {
    expect(validateLatLngInput("nope")).toBe("Coordinates must be valid lat,lng values");
  });

  it("validateLatLngInput returns null on valid", () => {
    expect(validateLatLngInput("1,2")).toBe(null);
  });

  it("parseAndFormatLatLngInput returns formatted lat/lng", () => {
    const res = parseAndFormatLatLngInput("1,2");
    expect(res).toEqual({ lat: 1, lng: 2, formatted: "1.000000,2.000000" });
  });

  it("parseAndFormatLatLngInput returns null for invalid", () => {
    expect(parseAndFormatLatLngInput("wat")).toBe(null);
  });
});
