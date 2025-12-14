import "@testing-library/jest-dom/vitest";

const existingNavigator = (globalThis as any).navigator;

const nextNavigator = {
  ...(existingNavigator ?? {}),
  userAgent: existingNavigator?.userAgent ?? "jsdom",
  geolocation: {
    ...(existingNavigator?.geolocation ?? {}),
    getCurrentPosition: (_success: any, error?: any) => {
      if (error) error(new Error("geolocation disabled in tests"));
    },
  },
};

Object.defineProperty(globalThis, "navigator", {
  value: nextNavigator,
  writable: true,
});
