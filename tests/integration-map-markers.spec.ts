import { test, expect } from "@playwright/test";

type BenchInsert = {
  latitude: number;
  longitude: number;
  status: "approved";
  description: string | null;
  created_by?: string | null;
  main_photo_url?: string | null;
};

async function waitForBenchMarkerRendered(page: any, title: string) {
  await page.waitForFunction(
    (t) => {
      const map = (window as any).__BENCHRADAR_MAP__;
      if (!map) return false;

      const layers = Object.values((map as any)._layers ?? {});
      const cluster = layers.find((layer: any) => typeof layer?.zoomToShowLayer === "function");
      if (!cluster || typeof cluster.getLayers !== "function") return false;

      const markers = cluster.getLayers();
      return markers.some(
        (m: any) =>
          m &&
          m.options &&
          m.options.title === t &&
          typeof m.openPopup === "function" &&
          typeof m.getLatLng === "function" &&
          Boolean(m._icon),
      );
    },
    title,
  );
}

async function waitForBenchMarker(page: any, title: string) {
  await page.waitForFunction(
    (t) => {
      const map = (window as any).__BENCHRADAR_MAP__;
      if (!map) return false;

      const layers = Object.values((map as any)._layers ?? {});
      const cluster = layers.find((layer: any) => typeof layer?.zoomToShowLayer === "function");
      if (!cluster || typeof cluster.getLayers !== "function") return false;

      const markers = cluster.getLayers();
      return markers.some(
        (m: any) =>
          m &&
          m.options &&
          m.options.title === t &&
          typeof m.openPopup === "function" &&
          typeof m.getLatLng === "function",
      );
    },
    title,
  );
}

async function openBenchPopup(page: any, title: string) {
  await page.evaluate((t) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const map = (window as any).__BENCHRADAR_MAP__;
        if (!map) throw new Error("Missing __BENCHRADAR_MAP__");

        if (typeof map.closePopup === "function") {
          map.closePopup();
        }

        const layers = Object.values((map as any)._layers ?? {});
        const cluster = layers.find(
          (layer: any) => typeof layer?.zoomToShowLayer === "function",
        );
        if (!cluster || typeof cluster.getLayers !== "function") {
          throw new Error("Marker cluster group not found.");
        }

        const markers = cluster.getLayers();
        const marker = markers.find(
          (m: any) =>
            m &&
            m.options &&
            m.options.title === t &&
            typeof m.openPopup === "function" &&
            typeof m.getLatLng === "function",
        );
        if (!marker) throw new Error(`Marker not found for title: ${t}`);

        let done = false;
        const finishOk = () => {
          if (done) return;
          done = true;
          resolve();
        };
        const finishErr = (e: any) => {
          if (done) return;
          done = true;
          reject(e);
        };

        const timeout = setTimeout(() => {
          try {
            marker.openPopup();
            finishOk();
          } catch (e: any) {
            finishErr(e);
          }
        }, 5000);

        try {
          cluster.zoomToShowLayer(marker, () => {
            clearTimeout(timeout);
            try {
              marker.openPopup();
              finishOk();
            } catch (e: any) {
              finishErr(e);
            }
          });
        } catch (e: any) {
          clearTimeout(timeout);
          finishErr(e);
        }
      } catch (e: any) {
        reject(e);
      }
    });
  }, title);

  await page.waitForFunction(
    (t) => {
      const popups = document.querySelectorAll(".leaflet-popup");
      return Array.from(popups).some((p) => (p.textContent ?? "").includes(t));
    },
    title,
  );
}

async function resetAndSeedBenches(): Promise<{ benches: BenchInsert[] }> {
  const apiUrl = process.env.API_URL;
  const serviceKey = process.env.SERVICE_ROLE_KEY;

  if (!apiUrl) {
    throw new Error("Missing API_URL (expected from local supabase status).");
  }
  if (!serviceKey) {
    throw new Error("Missing SERVICE_ROLE_KEY (expected from local supabase status).");
  }

  const restBase = `${apiUrl.replace(/\/$/, "")}/rest/v1`;

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  // Clean slate in local DB.
  {
    const del = await fetch(`${restBase}/bench_photos?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
      headers,
    });
    if (!del.ok && del.status !== 204) {
      throw new Error(`Failed to delete bench_photos: ${del.status} ${await del.text()}`);
    }
  }
  {
    const del = await fetch(`${restBase}/benches?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
      headers,
    });
    if (!del.ok && del.status !== 204) {
      throw new Error(`Failed to delete benches: ${del.status} ${await del.text()}`);
    }
  }

  // Spread out so that at zoom=16 they don't cluster.
  const benches: BenchInsert[] = [
    {
      latitude: 52.2297,
      longitude: 21.0122,
      status: "approved",
      description: "it-seed-1",
      main_photo_url: null,
    },
    {
      latitude: 52.2317,
      longitude: 21.0122,
      status: "approved",
      description: "it-seed-2",
      main_photo_url: null,
    },
    {
      latitude: 52.2297,
      longitude: 21.0142,
      status: "approved",
      description: "it-seed-3",
      main_photo_url: null,
    },
    {
      latitude: 52.2897,
      longitude: 21.0122,
      status: "approved",
      description: "it-seed-far",
      main_photo_url: null,
    },
  ];

  const insert = await fetch(`${restBase}/benches`, {
    method: "POST",
    headers,
    body: JSON.stringify(benches),
  });

  if (!insert.ok) {
    throw new Error(`Failed to seed benches: ${insert.status} ${await insert.text()}`);
  }

  return { benches };
}

test.describe.serial("integration map markers", () => {
  let benches: BenchInsert[] = [];

  test.beforeAll(async () => {
    ({ benches } = await resetAndSeedBenches());
  });

  test("seeded benches are visible as markers", async ({ page }) => {
    const nearBenches = benches.filter((b) => b.description !== "it-seed-far");

    await page.goto("/");

    await page.waitForFunction(() => {
      return Boolean((window as any).__BENCHRADAR_MAP__);
    });

    // Center map on seeded benches and zoom in to avoid clustering.
    await page.evaluate(() => {
      const map = (window as any).__BENCHRADAR_MAP__;
      if (!map) return;
      map.setView({ lat: 52.2297, lng: 21.0122 }, 16, { animate: false });
    });

    // Wait for benches to load and render.
    await page.waitForTimeout(800);

    for (const bench of nearBenches) {
      if (!bench.description) {
        throw new Error("Seeded bench is missing description.");
      }

      await waitForBenchMarkerRendered(page, bench.description);
      await openBenchPopup(page, bench.description);
      await expect(page.getByText(bench.description ?? "")).toBeVisible();
    }
  });

  test("can pan the map to find an offscreen bench marker", async ({ page }) => {
    const farBench = benches.find((b) => b.description === "it-seed-far");
    if (!farBench) throw new Error("Missing far bench seed.");
    if (!farBench.description) throw new Error("Missing far bench description.");

    await page.goto("/");

    await page.waitForFunction(() => {
      return Boolean((window as any).__BENCHRADAR_MAP__);
    });

    await page.evaluate(() => {
      const map = (window as any).__BENCHRADAR_MAP__;
      if (!map) return;
      map.setView({ lat: 52.2297, lng: 21.0122 }, 16, { animate: false });
    });

    // Move to a location that should include the far bench.
    const moved = await page.evaluate((b) => {
      const map = (window as any).__BENCHRADAR_MAP__;
      if (!map) return false;
      map.setView({ lat: b.latitude, lng: b.longitude }, 16, { animate: false });
      const center = map.getCenter();
      return Math.abs(center.lat - b.latitude) < 0.0005 && Math.abs(center.lng - b.longitude) < 0.0005;
    }, farBench);

    if (!moved) {
      throw new Error("Map did not move to far bench location.");
    }

    await waitForBenchMarker(page, farBench.description);
    await openBenchPopup(page, farBench.description);
    await expect(page.getByText(farBench.description ?? "")).toBeVisible();
  });
});
