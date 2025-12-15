import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import type { Bench } from "../store/useBenchStore";
import { formatLatLngInput } from "../lib/geo";
import { BenchEditorForm } from "../components/bench/BenchEditorForm";
import { useBenchEditorController } from "../hooks/useBenchEditorController";
import {
  deleteBench,
  deleteBenchPhotosByUrls,
  fetchUserRole,
  updateBenchStatus,
} from "../repositories/benchRepository";
import { getCurrentUser } from "../repositories/authRepository";
import {
  TAB_CONFIG,
  type BenchAdminRow,
  type TabKey,
  useAdminTabs,
  isTabKey,
} from "../hooks/useAdminTabs";

export function AdminPage() {
  const params = useParams<{ tabKey?: string }>();
  const initialRouteTab = isTabKey(params.tabKey) ? params.tabKey : "pending";
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    activeTab,
    setActiveTab,
    activeTabState,
    sentinelRef,
    removeBenchFromTabs,
    insertBenchIntoTab,
    updateBenchInTabs,
  } = useAdminTabs(initialRouteTab, isAdmin, { onError: setError });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const user = await getCurrentUser();

      if (cancelled) return;

      setUser(user ?? null);

      if (!user) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      const { role, error: profileError } = await fetchUserRole({ userId: user.id });

      if (profileError) {
        setError(profileError);
        setAuthLoading(false);
        return;
      }

      const admin = role === "admin";

      if (cancelled) return;

      setIsAdmin(admin);
      setAuthLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChangeStatus = async (
    bench: BenchAdminRow,
    status: Bench["status"]
  ) => {
    const { error: updateError } = await updateBenchStatus({
      benchId: bench.id,
      status,
    });

    if (updateError) {
      window.alert(updateError);
      return;
    }

    removeBenchFromTabs(bench.id);
    insertBenchIntoTab({ ...bench, status }, status);
  };

  const handleDeleteBench = async (bench: BenchAdminRow) => {
    const confirmDelete = window.confirm(
      "Delete this bench permanently? This cannot be undone."
    );
    if (!confirmDelete) return;

    const { error: photosError } = await deleteBenchPhotosByUrls({
      benchId: bench.id,
      urls: bench.photoUrls ?? [],
    });

    if (photosError) {
      window.alert(photosError);
      return;
    }

    const { error: benchError } = await deleteBench({ benchId: bench.id });

    if (benchError) {
      window.alert(benchError);
      return;
    }

    removeBenchFromTabs(bench.id);
  };

  const routeTab = isTabKey(params.tabKey) ? params.tabKey : "pending";

  useEffect(() => {
    if (params.tabKey && !isTabKey(params.tabKey)) {
      navigate("/admin", { replace: true });
    }
  }, [params.tabKey, navigate]);

  useEffect(() => {
    if (activeTab !== routeTab) {
      setActiveTab(routeTab);
    }
  }, [routeTab, activeTab]);

  const editingBenchIdRef = useRef<string | null>(null);
  const adminMapRef = useRef<any>(null);

  const editor = useBenchEditorController({
    benches: activeTabState.items as any,
    setBenches: (next) => {
      const editingId = editingBenchIdRef.current;
      if (!editingId) return;
      const updated = next.find((b) => b.id === editingId);
      if (!updated) return;
      updateBenchInTabs(editingId, (prev) => ({
        ...prev,
        latitude: updated.latitude,
        longitude: updated.longitude,
        description: updated.description ?? null,
        mainPhotoUrl: updated.mainPhotoUrl ?? prev.mainPhotoUrl,
        photoUrls: updated.photoUrls ?? prev.photoUrls,
      }));
    },
    user: user ? { id: user.id, email: user.email } : null,
    isAdmin,
    openSignIn: () => {},
    mapRef: adminMapRef,
    setCenter: () => {},
    setAddMode: () => {},
  });

  const editingBench = editor.editingBench as any as BenchAdminRow | null;
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const openEditDialog = (bench: BenchAdminRow) => {
    editingBenchIdRef.current = bench.id;
    editor.startEditingBench(bench as any);
  };

  const closeEditDialog = () => {
    editingBenchIdRef.current = null;
    editor.resetEditor();
  };

  const handleEditBench = (bench: BenchAdminRow) => {
    openEditDialog(bench);
  };

  const handleTabChange = (tab: TabKey) => {
    if (tab === "pending") {
      navigate("/admin");
    } else {
      navigate(`/admin/${tab}`);
    }
    setActiveTab(tab);
  };

  return (
    <div className="flex h-dvh w-dvw flex-col bg-slate-950 text-slate-50">
      <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-800/80 bg-slate-900/80 text-slate-50 transition hover:bg-slate-800/90 active:scale-95"
            aria-label="Back to map"
            onClick={() => navigate("/")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold tracking-wide text-sky-200">
            BenchRadar Admin
          </h1>
        </div>
        {user && (
          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300">
            {user.email}
          </span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-3 pb-20 pt-3">
        {authLoading && (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Loading benches...
          </div>
        )}

        {!authLoading && error && (
          <div className="flex h-full items-center justify-center text-xs text-rose-300">
            {error}
          </div>
        )}

        {!authLoading && !error && !isAdmin && (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            You must be an admin to view this screen.
          </div>
        )}

        {!authLoading && !error && isAdmin && (
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/70 px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                {TAB_CONFIG[activeTab].label}
              </h2>
              <span
                className={`h-1 w-16 rounded-full bg-gradient-to-r ${TAB_CONFIG[activeTab].accent}`}
              />
            </div>

            <div className="flex-1 space-y-2">
              {activeTabState.loading && (
                <div className="flex justify-center py-6 text-xs text-slate-400">
                  Loading...
                </div>
              )}

              {!activeTabState.loading &&
                activeTabState.items.map((bench) => (
                  <article
                    key={bench.id}
                    className="relative flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/80 p-3 shadow-lg shadow-slate-950/40 md:flex-row md:items-stretch"
                  >
                    <div className="flex flex-1 flex-col gap-2 pr-28 text-pretty md:pr-0">
                      <div className="text-[11px] leading-snug text-slate-100 break-words">
                        {bench.description || (
                          <span className="text-slate-500">No description</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                        <span className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-200">
                          {bench.createdBy.slice(0, 10)}…
                        </span>
                        <span>
                          {bench.latitude.toFixed(4)}, {bench.longitude.toFixed(4)}
                        </span>
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        Submitted {new Date(bench.createdAt).toLocaleString()}
                      </div>
                      {bench.photoUrls && bench.photoUrls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {bench.photoUrls.map((url) => (
                            <div
                              key={url}
                              className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 shadow"
                            >
                              <img
                                src={url}
                                alt="Bench"
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="absolute right-3 top-3 flex gap-2">
                      <button
                        type="button"
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/90 text-lg font-semibold text-slate-100 shadow-inner shadow-slate-900/40 transition active:scale-[0.97]"
                        onClick={() => handleEditBench(bench)}
                        aria-label="Edit details"
                      >
                        ✎
                      </button>
                      {activeTab === "pending" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/90 text-lg font-semibold text-slate-900 shadow-inner shadow-emerald-900/20 transition active:scale-[0.97]"
                            onClick={() => handleChangeStatus(bench, "approved")}
                            aria-label="Approve bench"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/90 text-lg font-semibold text-white shadow-inner shadow-rose-900/30 transition active:scale-[0.97]"
                            onClick={() => handleChangeStatus(bench, "rejected")}
                            aria-label="Reject bench"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {activeTab === "rejected" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/90 text-lg font-semibold text-slate-900 shadow-inner shadow-emerald-900/20 transition active:scale-[0.97]"
                            onClick={() => handleChangeStatus(bench, "approved")}
                            aria-label="Approve bench"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-700/90 text-lg font-semibold text-white shadow-inner shadow-rose-900/30 transition active:scale-[0.97]"
                            onClick={() => handleDeleteBench(bench)}
                            aria-label="Delete bench"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {activeTab === "approved" && (
                        <button
                          type="button"
                          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/90 text-lg font-semibold text-white shadow-inner shadow-rose-900/30 transition active:scale-[0.97]"
                          onClick={() => handleChangeStatus(bench, "rejected")}
                          aria-label="Reject bench"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </article>
                ))}

              {!activeTabState.loading && activeTabState.items.length === 0 && (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                  {TAB_CONFIG[activeTab].empty}
                </div>
              )}

              {activeTabState.loadingMore && (
                <div className="py-4 text-center text-[11px] text-slate-400">
                  Loading more...
                </div>
              )}

              <div ref={sentinelRef} className="h-6 w-full" />
            </div>
          </div>
        )}
      </main>

      {isAdmin && (
        <footer className="border-t border-slate-800/80 bg-slate-950/90 px-3 py-3">
          <div className="mx-auto w-full max-w-[320px]">
            <div className="grid grid-cols-3 gap-1 rounded-full border border-slate-800/80 bg-slate-900/70 px-2 py-1.5">
              {(Object.keys(TAB_CONFIG) as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`h-11 rounded-full text-[11px] font-semibold tracking-wide transition ${
                    activeTab === tab
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => handleTabChange(tab)}
                >
                  {TAB_CONFIG[tab].label}
                </button>
              ))}
            </div>
          </div>
        </footer>
      )}

      {editingBench && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
            onClick={closeEditDialog}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
            <div className="w-full max-w-2xl rounded-3xl border border-slate-800/80 bg-slate-900/95 p-4 shadow-2xl shadow-slate-950/70">
              <div className="flex items-center justify-between pb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Editing submission
                  </p>
                  <div className="text-sm font-semibold text-slate-100">
                    {editingBench.description || "No description"}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {editingBench.latitude.toFixed(4)},{" "}
                    {editingBench.longitude.toFixed(4)}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/80 text-slate-200 transition hover:bg-slate-800/80 active:scale-95"
                  onClick={closeEditDialog}
                  aria-label="Close edit dialog"
                >
                  ✕
                </button>
              </div>

              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  void editor.handleFilesSelected(event.target.files);
                  if (event.target) {
                    event.target.value = "";
                  }
                }}
              />

              <BenchEditorForm
                mode="edit"
                heading="Edit bench"
                locationInput={editor.locationInput}
                onLocationInputChange={editor.handleLocationInputChange}
                onLocationInputBlur={editor.handleLocationInputBlur}
                locationInputError={editor.locationInputError}
                locationPlaceholder={formatLatLngInput(
                  editingBench.latitude,
                  editingBench.longitude
                )}
                existingPhotoUrls={editor.existingPhotoUrls}
                onRemoveExistingPhoto={editor.handleRemoveExistingPhoto}
                pendingFileList={editor.pendingFileList}
                dragFromIndexRef={editor.dragFromIndexRef}
                onReorderPendingPhoto={editor.movePhoto}
                onRemovePendingPhoto={editor.removePhoto}
                onAddPhotoClick={() => editFileInputRef.current?.click()}
                description={editor.draftDescription}
                onDescriptionChange={editor.setDraftDescription}
                onCancel={closeEditDialog}
                onSubmit={editor.handleEditSubmit}
                submitLabels={{
                  idle: "Save changes",
                  submitting: "Saving...",
                }}
                canDelete={false}
                isSubmitting={editor.isSubmitting}
                submitError={editor.submitError}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
