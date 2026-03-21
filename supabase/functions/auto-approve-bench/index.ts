import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  bench_id?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch photo (${res.status})`);
  }
  return await res.blob();
}

async function scoreWithHfSpace(args: { spaceBaseUrl: string; blob: Blob }): Promise<number> {
  const { spaceBaseUrl, blob } = args;
  const url = spaceBaseUrl.replace(/\/$/, "") + "/score";

  const form = new FormData();
  form.append("image", blob, "image.webp");

  const res = await fetch(url, {
    method: "POST",
    body: form,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HF score failed (${res.status}): ${text}`);
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("HF score returned non-JSON");
  }

  if (typeof data?.probability !== "number") {
    throw new Error("HF score missing probability");
  }

  return data.probability as number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const triggerSecret = Deno.env.get("AUTOAPPROVE_TRIGGER_SECRET") ?? "";
  const incomingSecret = req.headers.get("x-autoapprove-secret") ?? "";
  if (triggerSecret && incomingSecret !== triggerSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const spaceUrl = Deno.env.get("BENCH_DETECTOR_URL") ?? "";
  const minProb = Number(Deno.env.get("BENCH_DETECTOR_MIN_PROB") ?? "0.5");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }
  if (!spaceUrl) {
    return json({ error: "Missing BENCH_DETECTOR_URL" }, 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const benchId = body.bench_id;
  if (!benchId) {
    return json({ error: "Missing bench_id" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: benchRow, error: benchErr } = await supabase
    .from("benches")
    .select("id, status")
    .eq("id", benchId)
    .maybeSingle();

  if (benchErr) {
    return json({ error: "Failed to load bench" }, 500);
  }
  if (!benchRow) {
    return json({ ok: true, status: "missing" }, 200);
  }

  if (benchRow.status !== "pending") {
    return json({ ok: true, status: benchRow.status }, 200);
  }

  const { data: photos, error: photosErr } = await supabase
    .from("bench_photos")
    .select("url")
    .eq("bench_id", benchId);

  if (photosErr) {
    return json({ error: "Failed to load bench photos" }, 500);
  }

  const urls = (photos ?? []).map((p: any) => p.url).filter((u: any) => typeof u === "string");
  if (urls.length === 0) {
    return json({ ok: true, status: "pending", reason: "no photos" }, 200);
  }

  let minSeen = 1;
  for (const url of urls) {
    const blob = await fetchAsBlob(url);
    const prob = await scoreWithHfSpace({ spaceBaseUrl: spaceUrl, blob });
    minSeen = Math.min(minSeen, prob);
    if (prob < minProb) {
      return json({ ok: true, status: "pending", approved: false, min_probability: minSeen }, 200);
    }
  }

  const { error: updateErr } = await supabase
    .from("benches")
    .update({ status: "approved" })
    .eq("id", benchId)
    .eq("status", "pending");

  if (updateErr) {
    return json({ error: "Failed to update bench status" }, 500);
  }

  return json({ ok: true, status: "approved", min_probability: minSeen }, 200);
});
