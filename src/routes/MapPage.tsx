import { useEffect, useRef, useState } from "react";
import { divIcon, type LatLngExpression, type Map as LeafletMap } from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import imageCompression from "browser-image-compression";
import * as exifr from "exifr";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { useBenchStore } from "../store/useBenchStore";
import type { Bench } from "../store/useBenchStore";
import { supabase } from "../lib/supabaseClient";
import { useMapUiStore } from "../store/useMapUiStore";
import { MapHeader } from "../components/map/MapHeader";
import { HamburgerMenu } from "../components/map/HamburgerMenu";
import { AuthModal } from "../components/map/AuthModal";
import { AddBenchUi } from "../components/map/AddBenchUi";

const DEFAULT_CENTER: LatLngExpression = [52.2297, 21.0122]; // Warsaw as a neutral default

type BenchRow = {
  id: string;
  latitude: number;
  longitude: number;
  title: string | null;
  description: string | null;
  main_photo_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_by: string;
};

const approvedIcon = divIcon({
  className:
    "w-[18px] h-[18px] rounded-full border-2 border-slate-900/90 shadow-[0_0_0_2px_rgba(15,23,42,0.65)] bg-emerald-500",
  iconAnchor: [7, 7],
  iconSize: [14, 14],
});

function createBenchPhotoIcon(url: string) {
  const thumbUrl = toThumbnailUrl(url);
  return divIcon({
    className: "bench-photo-marker",
    html: `
      <div class="w-10 h-10 rounded-[12px] border-2 border-white shadow-[0_0_0_2px_rgba(15,23,42,0.9)] overflow-hidden bg-slate-200">
        <img
          src="${thumbUrl}"
          onerror="this.onerror=null;this.src='${url}'"
          class="w-full h-full object-cover block"
        />
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

const pendingIcon = divIcon({
  className:
    "w-[18px] h-[18px] rounded-full border-2 border-slate-900/90 shadow-[0_0_0_2px_rgba(15,23,42,0.65)] bg-amber-300",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const rejectedIcon = divIcon({
  className:
    "w-[18px] h-[18px] rounded-full border-2 border-slate-900/90 shadow-[0_0_0_2px_rgba(15,23,42,0.65)] bg-rose-400",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const userIcon = divIcon({
  className:
    "w-[14px] h-[14px] rounded-full bg-sky-500 border border-sky-400 shadow-[0_0_0_3px_rgba(15,23,42,0.85)]",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const compressImage = imageCompression as unknown as (
  file: File,
  options: {
    maxSizeMB: number;
    maxWidthOrHeight: number;
    useWebWorker: boolean;
  }
) => Promise<File>;

async function convertToJpeg(
  file: File,
  maxSize: number
): Promise<File> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
  );

  if (!blob) {
    throw new Error("JPEG conversion failed");
  }

  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, "") + ".jpg",
    { type: "image/jpeg" }
  );
}

function toThumbnailUrl(url: string): string {
  const [base, query] = url.split("?", 2);
  const lastDot = base.lastIndexOf(".");
  if (lastDot === -1) return url;
  const withThumb = `${base.slice(0, lastDot)}_thumb${base.slice(lastDot)}`;
  return query ? `${withThumb}?${query}` : withThumb;
}

export function MapPage() {
  const [center, setCenter] = useState(DEFAULT_CENTER as LatLngExpression);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLngExpression | null>(
    null
  );
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [chosenLocation, setChosenLocation] = useState<LatLngExpression | null>(
    null
  );
  const [draftDescription, setDraftDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingBench, setEditingBench] = useState<Bench | null>(null);
  const [removeExistingMainPhoto, setRemoveExistingMainPhoto] =
    useState(false);
  const [mapStyle, setMapStyle] = useState<"normal" | "satellite">("normal");
  const mapRef = useRef<LeafletMap | null>(null);
  const selectFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);
  const dragFromIndexRef = useRef<number | null>(null);
  const { benches, setBenches } = useBenchStore();
  const navigate = useNavigate();

  const {
    isMenuOpen,
    isAddOpen,
    addMode,
    authMode,
    toggleMenu,
    toggleAdd,
    setMenuOpen,
    setAddOpen,
    setAddMode,
    setAuthMode,
  } = useMapUiStore();

  const isSignedIn = !!user;
  const pendingFileList = pendingFiles ?? [];

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    setPendingFiles((prev) => [...(prev ?? []), ...incoming]);

    // If we don't yet have a chosenLocation, try to read it from EXIF of the first photo
    if (!chosenLocation) {
      try {
        const gps = await exifr.gps(incoming[0]);
        if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
          const loc: LatLngExpression = [gps.latitude, gps.longitude];
          setChosenLocation(loc);
          setCenter(loc);
          if (mapRef.current) {
            mapRef.current.setView({ lat: gps.latitude, lng: gps.longitude });
          }
        }
      } catch (_err) {
        // silently fall back to manual map selection
      }
    }

    setAddMode("details");
  };

  const handleEditSubmit = async () => {
    if (!editingBench) return;

    if (!user) {
      openSignIn();
      return;
    }

    const baseLatLng: [number, number] = [
      editingBench.latitude,
      editingBench.longitude,
    ];

    const [lat, lng] =
      chosenLocation && Array.isArray(chosenLocation)
        ? (chosenLocation as [number, number])
        : baseLatLng;

    const hasExisting =
      !removeExistingMainPhoto && !!editingBench.mainPhotoUrl;
    const hasNew = pendingFiles && pendingFiles.length > 0;

    if (!hasExisting && !hasNew) {
      setSubmitError("Add at least one photo.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const uploadedUrls: string[] = [];
      let mainPhotoUrl = editingBench.mainPhotoUrl ?? null;

      if (pendingFiles && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const largeJpeg = await convertToJpeg(file, 1080);
          const thumbJpeg = await convertToJpeg(file, 48);

          const id = crypto.randomUUID();
          const largePath = `${user.id}/${id}.jpg`;
          const thumbPath = `${user.id}/${id}_thumb.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("bench_photos")
            .upload(largePath, largeJpeg, {
              contentType: "image/jpeg",
              upsert: false,
            });

          if (uploadError) {
            setSubmitError("Uploading photos failed. Please try again.");
            return;
          }

          await supabase.storage
            .from("bench_photos")
            .upload(thumbPath, thumbJpeg, {
              contentType: "image/jpeg",
              upsert: false,
            });

          const {
            data: { publicUrl },
          } = supabase.storage.from("bench_photos").getPublicUrl(largePath);

          uploadedUrls.push(publicUrl);
        }
      }

      if (removeExistingMainPhoto) {
        mainPhotoUrl = null;
      }

      if (uploadedUrls.length > 0 && !mainPhotoUrl) {
        mainPhotoUrl = uploadedUrls[0];
      }

      const updates: Record<string, unknown> = {
        latitude: lat,
        longitude: lng,
        description: draftDescription || null,
      };

      if (mainPhotoUrl !== editingBench.mainPhotoUrl) {
        updates.main_photo_url = mainPhotoUrl;
      }

      const { error: benchError } = await supabase
        .from("benches")
        .update(updates)
        .eq("id", editingBench.id);

      if (benchError) {
        setSubmitError("Saving bench failed. Please try again.");
        return;
      }

      if (removeExistingMainPhoto && editingBench.mainPhotoUrl) {
        await supabase
          .from("bench_photos")
          .delete()
          .eq("bench_id", editingBench.id)
          .eq("url", editingBench.mainPhotoUrl);
      }

      if (uploadedUrls.length > 0) {
        const photoRows = uploadedUrls.map((url, index) => ({
          bench_id: editingBench.id,
          url,
          is_main: index === 0,
        }));

        await supabase.from("bench_photos").insert(photoRows);
      }

      setBenches(
        benches.map((b) =>
          b.id === editingBench.id
            ? {
                ...b,
                latitude: lat,
                longitude: lng,
                description: draftDescription || null,
                mainPhotoUrl,
              }
            : b
        )
      );

      setAddMode("idle");
      setEditingBench(null);
      setRemoveExistingMainPhoto(false);
      setPendingFiles(null);
      setDraftDescription("");
      setChosenLocation(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBench = async (bench: Bench) => {
    if (!user) {
      openSignIn();
      return;
    }

    if (!isAdmin && bench.createdBy && bench.createdBy !== user.id) {
      return;
    }

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

    setBenches(benches.filter((b) => b.id !== bench.id));
    setAddMode("idle");
    setEditingBench(null);
    setPendingFiles(null);
    setDraftDescription("");
    setChosenLocation(null);
    setSubmitError(null);
  };

  const openSignIn = () => {
    setAuthError(null);
    setAuthEmail("");
    setAuthPassword("");
    setAuthMode("signin");
    setMenuOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setUser(null);
    setMenuOpen(false);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error || !data.user) {
      setAuthError("Invalid email or password.");
    } else {
      setUser(data.user);
      setAuthMode("closed");
    }

    setAuthLoading(false);
  };

  const startEditingBench = (bench: Bench) => {
    if (!user) {
      openSignIn();
      return;
    }

    if (!isAdmin && bench.createdBy && bench.createdBy !== user.id) {
      return;
    }

    setEditingBench(bench);
    setDraftDescription(bench.description ?? "");
    setChosenLocation([bench.latitude, bench.longitude]);
    setPendingFiles(null);
    setSubmitError(null);
    setAddMode("details");
  };

  const handleChooseLocation = () => {
    if (!mapRef.current) {
      setAddMode("idle");
      return;
    }
    const c = mapRef.current.getCenter();
    const location: LatLngExpression = [c.lat, c.lng];
    setChosenLocation(location);
    setAddMode("details");
  };

  const movePhoto = (fromIndex: number, toIndex: number) => {
    setPendingFiles((current) => {
      if (!current) return current;
      if (toIndex < 0 || toIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const handleCreateSubmit = async () => {
    if (!pendingFiles || pendingFiles.length === 0) {
      setSubmitError("Add at least one photo.");
      return;
    }

    if (!chosenLocation || !Array.isArray(chosenLocation)) {
      setSubmitError("Choose a location on the map.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSubmitError("You need to be signed in to add a bench.");
        return;
      }

      const [lat, lng] = chosenLocation as [number, number];
      const uploadedUrls: string[] = [];

      for (const file of pendingFiles) {
        const largeJpeg = await convertToJpeg(file, 1080);
        const thumbJpeg = await convertToJpeg(file, 48);

        const id = crypto.randomUUID();
        const largePath = `${user.id}/${id}.jpg`;
        const thumbPath = `${user.id}/${id}_thumb.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("bench_photos")
          .upload(largePath, largeJpeg, {
            contentType: "image/jpeg",
            upsert: false,
          });

        if (uploadError) {
          setSubmitError("Uploading photos failed. Please try again.");
          return;
        }

        await supabase.storage
          .from("bench_photos")
          .upload(thumbPath, thumbJpeg, {
            contentType: "image/jpeg",
            upsert: false,
          });

        const {
          data: { publicUrl },
        } = supabase.storage.from("bench_photos").getPublicUrl(largePath);

        uploadedUrls.push(publicUrl);
      }

      const mainPhotoUrl = uploadedUrls[0] ?? null;

      const { data: benchRow, error: benchError } = await supabase
        .from("benches")
        .insert({
          created_by: user.id,
          status: "pending",
          latitude: lat,
          longitude: lng,
          description: draftDescription || null,
          main_photo_url: mainPhotoUrl,
        })
        .select("id")
        .single();

      if (benchError || !benchRow) {
        setSubmitError("Saving bench failed. Please try again.");
        return;
      }

      if (uploadedUrls.length > 0) {
        const photoRows = uploadedUrls.map((url, index) => ({
          bench_id: benchRow.id,
          url,
          is_main: index === 0,
        }));

        await supabase.from("bench_photos").insert(photoRows);
      }

      const newBench: Bench = {
        id: benchRow.id,
        latitude: lat,
        longitude: lng,
        title: null,
        description: draftDescription || null,
        mainPhotoUrl,
        createdBy: user.id,
        status: "pending" as const,
      };

      setBenches([...benches, newBench]);

      setAddMode("idle");
      setPendingFiles(null);
      setDraftDescription("");
      setChosenLocation(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removePhoto = (index: number) => {
    setPendingFiles((current) => {
      if (!current) return current;
      const next = current.filter((_, i) => i !== index);
      return next.length > 0 ? next : null;
    });
  };

  const handleRecenterOnUser = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.setView(userLocation as any, mapRef.current.getZoom());
  };

  const handleToggleMapStyle = () => {
    setMapStyle((prev) => (prev === "normal" ? "satellite" : "normal"));
  };

  const fetchBenchesForCurrentBounds = async () => {
    // Use current map bounds to limit benches we load
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();

    const { data, error } = await supabase
      .from("benches")
      .select(
        "id, latitude, longitude, title, description, main_photo_url, status, created_by"
      )
      .gte("latitude", south)
      .lte("latitude", north)
      .gte("longitude", west)
      .lte("longitude", east);

    if (error || !data) {
      return;
    }

    const rows = data as BenchRow[];

    setBenches(
      rows.map((row) => ({
        id: row.id,
        latitude: row.latitude,
        longitude: row.longitude,
        title: row.title,
        description: row.description,
        mainPhotoUrl: row.main_photo_url,
        status: row.status,
        createdBy: row.created_by,
      }))
    );
  };

  useEffect(() => {
    const nav = navigator as Navigator & { geolocation?: Geolocation };

    if (!nav.geolocation) {
      setCenter(DEFAULT_CENTER);
      return;
    }

    nav.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        const loc: LatLngExpression = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setCenter(loc);
        setUserLocation(loc);
      },
      () => {
        setCenter(DEFAULT_CENTER);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if (addMode === "idle") {
      setEditingBench(null);
      setRemoveExistingMainPhoto(false);
      setPendingFiles(null);
      setDraftDescription("");
      setChosenLocation(null);
      setSubmitError(null);
    }
  }, [addMode]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user ?? null);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!cancelled) {
          setUser(session?.user ?? null);
        }
      }
    );

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Determine if current user is admin
      let admin = false;

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        admin = profile?.role === "admin";
      }

      if (cancelled) return;

      setIsAdmin(admin);

      if (!cancelled) {
        await fetchBenchesForCurrentBounds();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setBenches, user]);

  const mapCenter = center;

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-slate-950">
      <MapContainer
        center={mapCenter}
        zoom={14}
        scrollWheelZoom
        className="z-0 h-full w-full"
        ref={mapRef}
        whenCreated={(mapInstance) => {
          mapRef.current = mapInstance;
          void fetchBenchesForCurrentBounds();
          mapInstance.on("moveend", () => {
            void fetchBenchesForCurrentBounds();
          });
        }}
      >
        {mapStyle === "normal" ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
          />
        ) : (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        {userLocation && <Marker position={userLocation} icon={userIcon} />}

        {benches.map((bench: Bench) => (
          <Marker
            key={bench.id}
            position={[bench.latitude, bench.longitude]}
            icon={
              bench.mainPhotoUrl
                ? createBenchPhotoIcon(bench.mainPhotoUrl)
                : bench.status === "pending"
                ? pendingIcon
                : bench.status === "rejected"
                ? rejectedIcon
                : approvedIcon
            }
          >
            <Popup>
              <div className="flex max-w-[220px] flex-col gap-2">
                {bench.mainPhotoUrl && (
                  <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                    <img
                      src={bench.mainPhotoUrl}
                      alt={bench.description ?? "Bench"}
                      className="block h-32 w-full object-cover"
                    />
                  </div>
                )}
                {bench.description && (
                  <div className="text-xs text-slate-800">
                    {bench.description}
                  </div>
                )}
                {(isAdmin || (user && bench.createdBy === user.id)) && (
                  <button
                    type="button"
                    className="mt-1 inline-flex self-start rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-slate-50"
                    onClick={() => startEditingBench(bench)}
                  >
                    Edit
                  </button>
                )}
                {isAdmin && (
                  <div
                    className={`mt-1 inline-flex self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      bench.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : bench.status === "pending"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {bench.status}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map style + recenter controls */}
      <div className="pointer-events-none absolute right-3 top-24 z-[1000] flex flex-col items-end gap-2">
        {/* Circular Map / Satellite toggle button */}
        <button
          type="button"
          onClick={handleToggleMapStyle}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md shadow-slate-900/40 hover:bg-slate-50"
        >
          {mapStyle === "normal" ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-slate-300 bg-slate-100">
              <span className="h-3 w-4 rounded-[2px] bg-sky-400" />
            </span>
          ) : (
            <span className="grid h-6 w-6 grid-cols-2 gap-[1px] rounded-sm border border-slate-300 bg-slate-100">
              <span className="bg-slate-200" />
              <span className="bg-slate-400" />
              <span className="bg-slate-500" />
              <span className="bg-slate-700" />
            </span>
          )}
        </button>

        {userLocation && (
          <button
            type="button"
            onClick={handleRecenterOnUser}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md shadow-slate-900/40 hover:bg-slate-50"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-400">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
            </span>
          </button>
        )}
      </div>

      {/* Top iOS-like title bar */}
      <MapHeader />

      {/* Hidden file inputs for photo selection */}
      <input
        ref={selectFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <input
        ref={cameraFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      <AddBenchUi
        isSignedIn={isSignedIn}
        selectFileInputRef={selectFileInputRef}
        cameraFileInputRef={cameraFileInputRef}
        chosenLocation={chosenLocation}
        draftDescription={draftDescription}
        setDraftDescription={setDraftDescription}
        pendingFileList={pendingFileList}
        dragFromIndexRef={dragFromIndexRef}
        handleChooseLocation={handleChooseLocation}
        handleSubmit={editingBench ? handleEditSubmit : handleCreateSubmit}
        removePhoto={removePhoto}
        movePhoto={movePhoto}
        openSignIn={openSignIn}
        mode={editingBench ? "edit" : "create"}
        existingMainPhotoUrl={
          editingBench && !removeExistingMainPhoto
            ? editingBench.mainPhotoUrl ?? null
            : null
        }
        canDelete={
          !!editingBench &&
          (isAdmin || (user && editingBench.createdBy === user.id))
        }
        onDeleteBench={
          editingBench
            ? () => {
                void handleDeleteBench(editingBench);
              }
            : undefined
        }
        onRemoveExistingPhoto={
          editingBench
            ? () => {
                setRemoveExistingMainPhoto(true);
              }
            : undefined
        }
        submitError={submitError}
        isSubmitting={isSubmitting}
      />

      {/* Bottom-left hamburger menu */}
      <HamburgerMenu
        isSignedIn={isSignedIn}
        isAdmin={isAdmin}
        openSignIn={openSignIn}
        handleSignOut={handleSignOut}
        onGoToAdmin={() => navigate("/admin")}
      />

      <AuthModal
        authEmail={authEmail}
        authPassword={authPassword}
        authError={authError}
        authLoading={authLoading}
        setAuthEmail={setAuthEmail}
        setAuthPassword={setAuthPassword}
        handleAuthSubmit={handleAuthSubmit}
      />
    </div>
  );
}
