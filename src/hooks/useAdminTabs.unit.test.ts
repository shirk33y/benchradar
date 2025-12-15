import { describe, expect, it } from "vitest";

import { isTabKey, TAB_KEYS } from "./useAdminTabs";

describe("useAdminTabs helpers (unit)", () => {
  it("isTabKey accepts only known keys", () => {
    for (const key of TAB_KEYS) {
      expect(isTabKey(key)).toBe(true);
    }

    expect(isTabKey(undefined)).toBe(false);
    expect(isTabKey("")).toBe(false);
    expect(isTabKey("pending ")).toBe(false);
    expect(isTabKey("other")).toBe(false);
  });
});
