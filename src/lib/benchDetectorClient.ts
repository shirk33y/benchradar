export type BenchDetectorScoreResponse = {
  probability: number;
  model_id?: string;
  device?: string;
  elapsed_ms?: number;
};

export async function scoreBenchProbability(args: {
  baseUrl: string;
  file: File;
  signal?: AbortSignal;
}): Promise<BenchDetectorScoreResponse> {
  const { baseUrl, file, signal } = args;

  const url = baseUrl.replace(/\/$/, "") + "/score";

  const form = new FormData();
  form.append("image", file);

  const res = await fetch(url, {
    method: "POST",
    body: form,
    signal,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Bench detector request failed (${res.status})`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Bench detector returned non-JSON response");
  }

  if (typeof json?.probability !== "number") {
    throw new Error("Bench detector response missing probability");
  }

  return json as BenchDetectorScoreResponse;
}
