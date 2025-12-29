import type { Bench } from "../store/useBenchStore";
import { supabase } from "../lib/supabaseClient";
import { convertToWebp } from "../lib/imageProcessing";
import { scoreBenchProbability } from "../lib/benchDetectorClient";

type BenchPhotoRow = {
  bench_id: string;
  url: string | null;
  is_main: boolean | null;
};

type BenchRow = {
  id: string;
  latitude: number;
  longitude: number;
  title: string | null;
  description: string | null;
  main_photo_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_by: string | null;
};

type ProfileRow = {
  role: string | null;
};

export async function fetchUserRole(args: { userId: string }) {
  const { userId } = args;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { role: null as string | null, error: "Fetching profile failed." };
  }

  return { role: ((profile as ProfileRow | null)?.role ?? null) as string | null, error: null as string | null };
}

export async function updateBenchStatus(args: { benchId: string; status: Bench["status"] }) {
  const { benchId, status } = args;
  const { error } = await supabase
    .from("benches")
    .update({ status })
    .eq("id", benchId);

  if (error) {
    return { error: "Updating status failed. Please try again." };
  }

  return { error: null as string | null };
}

export async function updateBenchDetails(args: {
  benchId: string;
  latitude: number;
  longitude: number;
  description: string | null;
  mainPhotoUrl?: string | null;
}) {
  const { benchId, latitude, longitude, description, mainPhotoUrl } = args;

  const updates: Record<string, unknown> = {
    latitude,
    longitude,
    description,
  };

  if (mainPhotoUrl !== undefined) {
    updates.main_photo_url = mainPhotoUrl;
  }

  const { error } = await supabase.from("benches").update(updates).eq("id", benchId);
  if (error) {
    return { error: "Saving bench failed. Please try again." };
  }

  return { error: null as string | null };
}

export async function deleteBenchPhotosByUrls(args: { benchId: string; urls: string[] }) {
  const { benchId, urls } = args;
  if (!urls || urls.length === 0) {
    return { error: null as string | null };
  }

  const { error } = await supabase
    .from("bench_photos")
    .delete()
    .eq("bench_id", benchId)
    .in("url", urls);

  if (error) {
    return { error: "Deleting bench photos failed. Please try again." };
  }

  return { error: null as string | null };
}

export async function insertBenchPhotos(args: {
  benchId: string;
  urls: string[];
  mainPhotoUrl: string | null;
}) {
  const { benchId, urls, mainPhotoUrl } = args;
  if (!urls || urls.length === 0) {
    return { error: null as string | null };
  }

  const photoRows = urls.map((url) => ({
    bench_id: benchId,
    url,
    is_main: mainPhotoUrl === url,
  }));

  const { error } = await supabase.from("bench_photos").insert(photoRows);
  if (error) {
    return { error: "Saving photos failed. Please try again." };
  }

  return { error: null as string | null };
}

export async function createBench(args: {
  createdBy: string;
  status: Bench["status"];
  latitude: number;
  longitude: number;
  description: string | null;
  mainPhotoUrl: string | null;
}) {
  const { createdBy, status, latitude, longitude, description, mainPhotoUrl } = args;

  const { data: benchRow, error } = await supabase
    .from("benches")
    .insert({
      created_by: createdBy,
      status,
      latitude,
      longitude,
      description,
      main_photo_url: mainPhotoUrl,
    })
    .select("id")
    .single();

  if (error || !benchRow) {
    return { benchId: null as string | null, error: "Saving bench failed. Please try again." };
  }

  return { benchId: (benchRow as any).id as string, error: null as string | null };
}

export async function uploadBenchPhotoPair(args: {
  ownerId: string;
  id: string;
  largeWebp: File;
  thumbWebp: File;
}) {
  const { ownerId, id, largeWebp, thumbWebp } = args;
  const largePath = `${ownerId}/${id}.webp`;
  const thumbPath = `${ownerId}/${id}_thumb.webp`;

  const { error: uploadError } = await supabase.storage
    .from("bench_photos")
    .upload(largePath, largeWebp, {
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadError) {
    return { publicUrl: null as string | null, error: "Uploading photos failed. Please try again." };
  }

  await supabase.storage.from("bench_photos").upload(thumbPath, thumbWebp, {
    contentType: "image/webp",
    upsert: false,
  });

  const {
    data: { publicUrl },
  } = supabase.storage.from("bench_photos").getPublicUrl(largePath);

  return { publicUrl: publicUrl as string, error: null as string | null };
}

export async function uploadPendingBenchPhotos(args: {
  ownerId: string;
  files: File[];
}): Promise<{ urls: string[]; error: string | null }> {
  const { ownerId, files } = args;
  const uploadedUrls: string[] = [];

  const detectorUrl = (import.meta as any).env?.VITE_BENCH_DETECTOR_URL as string | undefined;
  const minProbRaw = (import.meta as any).env?.VITE_BENCH_DETECTOR_MIN_PROB as string | undefined;
  const minProb = minProbRaw ? Number(minProbRaw) : null;

  for (const file of files) {
    const largeWebp = await convertToWebp(file, 900);
    const thumbWebp = await convertToWebp(file, 48);

    if (detectorUrl) {
      try {
        const res = await scoreBenchProbability({ baseUrl: detectorUrl, file: largeWebp });
        const threshold = typeof minProb === "number" && !Number.isNaN(minProb) ? minProb : 0.5;
        if (res.probability < threshold) {
          return {
            urls: [],
            error: `Photo validation failed (bench prob ${(res.probability * 100).toFixed(0)}% < ${(threshold * 100).toFixed(0)}%).`,
          };
        }
      } catch (_err) {
        return {
          urls: [],
          error: "Photo validation failed (bench detector unreachable). Please try again.",
        };
      }
    }

    const id = crypto.randomUUID();
    const { publicUrl, error } = await uploadBenchPhotoPair({
      ownerId,
      id,
      largeWebp,
      thumbWebp,
    });

    if (error || !publicUrl) {
      return {
        urls: [],
        error: error ?? "Uploading photos failed. Please try again.",
      };
    }

    uploadedUrls.push(publicUrl);
  }

  return { urls: uploadedUrls, error: null };
}

type AdminBenchQueryRow = BenchRow & {
  created_at: string;
  bench_photos?: { url: string; is_main: boolean | null }[] | null;
};

export async function fetchBenchesForAdminTab(args: {
  status: Bench["status"];
  cursor: string | null;
  limit: number;
}) {
  const { status, cursor, limit } = args;

  let query = supabase
    .from("benches")
    .select(
      "id, latitude, longitude, title, description, main_photo_url, status, created_by, created_at, bench_photos(url, is_main)"
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) {
    return { data: null as AdminBenchQueryRow[] | null, error: "Loading benches failed." };
  }

  return { data: (data as AdminBenchQueryRow[]) ?? [], error: null as string | null };
}

export async function fetchBenchesWithPhotos(): Promise<Bench[]> {
  const { data: benchesData, error: benchesError } = await supabase
    .from("benches")
    .select(
      "id, latitude, longitude, title, description, main_photo_url, status, created_by",
    )
    .neq("status", "rejected");

  if (benchesError || !benchesData) {
    return [];
  }

  const benchRows = benchesData as BenchRow[];

  let photoMap: Record<string, string[]> = {};
  if (benchRows.length > 0) {
    const benchIds = benchRows.map((row) => row.id);
    const { data: photosData } = await supabase
      .from("bench_photos")
      .select("bench_id, url, is_main")
      .in("bench_id", benchIds);

    if (photosData) {
      const grouped: Record<string, BenchPhotoRow[]> = {};
      for (const photo of photosData as BenchPhotoRow[]) {
        if (!grouped[photo.bench_id]) {
          grouped[photo.bench_id] = [];
        }
        grouped[photo.bench_id].push(photo);
      }

      photoMap = Object.fromEntries(
        Object.entries(grouped).map(([benchId, items]) => {
          const sorted = items
            .slice()
            .sort((a, b) => {
              const aMain = a.is_main ? 0 : 1;
              const bMain = b.is_main ? 0 : 1;
              return aMain - bMain;
            })
            .map((p) => p.url)
            .filter((url): url is string => !!url);
          return [benchId, sorted];
        }),
      );
    }
  }

  const mappedBenches: Bench[] = benchRows.map((row) => {
    const photos = photoMap[row.id] ?? [];
    return {
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      title: row.title,
      description: row.description,
      mainPhotoUrl: row.main_photo_url,
      photoUrls:
        photos.length > 0
          ? photos
          : row.main_photo_url
            ? [row.main_photo_url]
            : [],
      status: row.status,
      createdBy: row.created_by ?? undefined,
    };
  });

  return mappedBenches.filter((bench) => bench.status !== "rejected");
}

export async function deleteBench(args: { benchId: string }) {
  const { benchId } = args;

  const { error: photosError } = await supabase
    .from("bench_photos")
    .delete()
    .eq("bench_id", benchId);

  const { error: benchError } = await supabase
    .from("benches")
    .delete()
    .eq("id", benchId);

  if (photosError || benchError) {
    return { error: "Deleting bench failed. Please try again." };
  }

  return { error: null };
}

export function canEditBench(args: {
  userId: string | null;
  isAdmin: boolean;
  bench: Bench;
}) {
  const { userId, isAdmin, bench } = args;
  if (!userId) return false;
  if (isAdmin) return true;
  if (!bench.createdBy) return false;
  return bench.createdBy === userId;
}
