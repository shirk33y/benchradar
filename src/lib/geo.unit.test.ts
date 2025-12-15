import { describe, expect, it } from "vitest";

import { formatLatLngInput, parseLatLngInput } from "./geo";

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
});
