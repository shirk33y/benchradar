import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabaseClient";
import type { Bench } from "../store/useBenchStore";

type BenchAdminRow = Bench & { createdBy: string };

export function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [benches, setBenches] = useState<BenchAdminRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      setUser(user ?? null);

      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const admin = profile?.role === "admin";

      if (cancelled) return;

      setIsAdmin(admin);

      if (!admin) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("benches")
        .select(
          "id, latitude, longitude, title, description, main_photo_url, status, created_by"
        );

      if (cancelled) return;

      if (error || !data) {
        setError("Loading benches failed.");
        setLoading(false);
        return;
      }

      const rows = data.map((row: any) => ({
        id: row.id,
        latitude: row.latitude,
        longitude: row.longitude,
        title: row.title,
        description: row.description,
        mainPhotoUrl: row.main_photo_url,
        status: row.status,
        createdBy: row.created_by,
      })) as BenchAdminRow[];

      setBenches(rows);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChangeStatus = async (benchId: string, status: Bench["status"]) => {
    const { error } = await supabase
      .from("benches")
      .update({ status })
      .eq("id", benchId);

    if (error) {
      window.alert("Updating status failed. Please try again.");
      return;
    }

    setBenches((prev) =>
      prev.map((b) => (b.id === benchId ? { ...b, status } : b))
    );
  };

  const handleEditDescription = async (bench: BenchAdminRow) => {
    const current = bench.description ?? "";
    const next = window.prompt("Edit bench description:", current);
    if (next === null || next === current) return;

    const trimmed = next.trim();

    const { error } = await supabase
      .from("benches")
      .update({ description: trimmed || null })
      .eq("id", bench.id);

    if (error) {
      window.alert("Saving changes failed. Please try again.");
      return;
    }

    setBenches((prev) =>
      prev.map((b) =>
        b.id === bench.id ? { ...b, description: trimmed || null } : b
      )
    );
  };

  const handleDeleteBench = async (bench: BenchAdminRow) => {
    const confirmDelete = window.confirm(
      "Delete this bench? This cannot be undone."
    );
    if (!confirmDelete) return;

    const { error: photosError } = await supabase
      .from("bench_photos")
      .delete()
      .eq("bench_id", bench.id);

    const { error: benchError } = await supabase
      .from("benches")
      .delete()
      .eq("id", bench.id);

    if (photosError || benchError) {
      window.alert("Deleting bench failed. Please try again.");
      return;
    }

    setBenches((prev) => prev.filter((b) => b.id !== bench.id));
  };

  const pending = benches.filter((b) => b.status === "pending");
  const approved = benches.filter((b) => b.status === "approved");
  const rejected = benches.filter((b) => b.status === "rejected");

  return (
    <div className="flex h-dvh w-dvw flex-col bg-slate-950 text-slate-50">
      <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-4 py-3">
        <h1 className="text-sm font-semibold tracking-wide text-sky-200">
          Admin moderation
        </h1>
        {user && (
          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300">
            {user.email}
          </span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-3 py-3">
        {loading && (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Loading benches...
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full items-center justify-center text-xs text-rose-300">
            {error}
          </div>
        )}

        {!loading && !error && !isAdmin && (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            You must be an admin to view this screen.
          </div>
        )}

        {!loading && !error && isAdmin && (
          <div className="flex flex-col gap-4">
            <Section
              title="Pending"
              benches={pending}
              accent="border-amber-400/60"
              onChangeStatus={handleChangeStatus}
              onEditDescription={handleEditDescription}
              onDelete={handleDeleteBench}
            />
            <Section
              title="Approved"
              benches={approved}
              accent="border-emerald-400/60"
              onChangeStatus={handleChangeStatus}
              onEditDescription={handleEditDescription}
              onDelete={handleDeleteBench}
            />
            <Section
              title="Rejected"
              benches={rejected}
              accent="border-rose-400/60"
              onChangeStatus={handleChangeStatus}
              onEditDescription={handleEditDescription}
              onDelete={handleDeleteBench}
            />
          </div>
        )}
      </main>
    </div>
  );
}

type SectionProps = {
  title: string;
  benches: BenchAdminRow[];
  accent: string;
  onChangeStatus: (id: string, status: Bench["status"]) => void;
  onEditDescription: (bench: BenchAdminRow) => void;
  onDelete: (bench: BenchAdminRow) => void;
};

function Section({
  title,
  benches,
  accent,
  onChangeStatus,
  onEditDescription,
  onDelete,
}: SectionProps) {
  if (benches.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-3 shadow-lg shadow-slate-950/70">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {title}
        </h2>
        <span
          className={`h-1.5 w-10 rounded-full bg-gradient-to-r from-transparent via-slate-400/60 to-transparent ${accent}`}
        />
      </div>

      <div className="flex flex-col gap-2">
        {benches.map((bench) => (
          <article
            key={bench.id}
            className="flex gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-2"
          >
            {bench.mainPhotoUrl && (
              <div className="h-14 w-20 overflow-hidden rounded-xl border border-slate-800/80">
                <img
                  src={bench.mainPhotoUrl}
                  alt={bench.description ?? "Bench"}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-1">
              <div className="text-[11px] text-slate-100">
                {bench.description || <span className="text-slate-500">No description</span>}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{bench.createdBy.slice(0, 10)}…</span>
                <span>
                  {bench.latitude.toFixed(4)}, {bench.longitude.toFixed(4)}
                </span>
              </div>
              <div className="mt-1 flex gap-1">
                <button
                  type="button"
                  className="rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] text-slate-100"
                  onClick={() => onEditDescription(bench)}
                >
                  Edit
                </button>
                {bench.status !== "approved" && (
                  <button
                    type="button"
                    className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold text-slate-950"
                    onClick={() => onChangeStatus(bench.id, "approved")}
                  >
                    Approve
                  </button>
                )}
                {bench.status !== "pending" && (
                  <button
                    type="button"
                    className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-semibold text-slate-950"
                    onClick={() => onChangeStatus(bench.id, "pending")}
                  >
                    Pending
                  </button>
                )}
                {bench.status !== "rejected" && (
                  <button
                    type="button"
                    className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-slate-50"
                    onClick={() => onChangeStatus(bench.id, "rejected")}
                  >
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  className="ml-auto rounded-full bg-rose-700/90 px-2 py-0.5 text-[10px] font-semibold text-slate-50"
                  onClick={() => onDelete(bench)}
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
