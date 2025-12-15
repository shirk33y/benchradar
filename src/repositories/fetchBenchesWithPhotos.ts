import type { Bench } from "../store/useBenchStore";

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

type SupabaseLike = {
  from: (table: string) => any;
};

export async function fetchBenchesWithPhotos(supabase: SupabaseLike): Promise<Bench[]> {
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
