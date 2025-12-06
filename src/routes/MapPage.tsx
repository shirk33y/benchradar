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
};

const approvedIcon = divIcon({
  className:
    "w-[18px] h-[18px] rounded-full border-2 border-slate-900/90 shadow-[0_0_0_2px_rgba(15,23,42,0.65)] bg-emerald-500",
  iconAnchor: [7, 7],
  iconSize: [14, 14],
});

function createBenchPhotoIcon(url: string) {
  return divIcon({
    className: "bench-photo-marker",
    html: `
      <div class="w-10 h-10 rounded-[12px] border-2 border-white shadow-[0_0_0_2px_rgba(15,23,42,0.9)] overflow-hidden bg-slate-200">
        <img
          src="${url}"
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

  const handleAuthSubmit = async (e: any) => {
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

  const handleSubmit = async () => {
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
        const compressed = await compressImage(file, {
          maxSizeMB: 2,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });

        const extFromType =
          compressed.type === "image/webp"
            ? "webp"
            : compressed.type === "image/jpeg"
            ? "jpg"
            : undefined;

        const fallbackExt = file.name.includes(".")
          ? file.name.split(".").pop() || "jpg"
          : "jpg";

        const ext = extFromType ?? fallbackExt;

        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("bench_photos")
          .upload(path, compressed, {
            contentType: compressed.type,
            upsert: false,
          });

        if (uploadError) {
          setSubmitError("Uploading photos failed. Please try again.");
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("bench_photos").getPublicUrl(path);

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

      const newBench = {
        id: benchRow.id,
        latitude: lat,
        longitude: lng,
        title: null,
        description: draftDescription || null,
        mainPhotoUrl,
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      const { data, error } = await supabase
        .from("benches")
        .select(
          "id, latitude, longitude, title, description, main_photo_url, status"
        );

      if (error || !data || cancelled) {
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
        }))
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [setBenches]);

  const mapCenter = center;

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-slate-950">
      <MapContainer
        center={mapCenter}
        zoom={14}
        scrollWheelZoom
        className="z-0 h-full w-full"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

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
              <div className="text-sm font-medium">
                {bench.title || "Bench"}
              </div>
              {bench.description && (
                <div className="mt-1 text-xs text-slate-700">
                  {bench.description}
                </div>
              )}
              {isAdmin && (
                <div
                  className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
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
            </Popup>
          </Marker>
        ))}
      </MapContainer>

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
        handleSubmit={handleSubmit}
        removePhoto={removePhoto}
        movePhoto={movePhoto}
        openSignIn={openSignIn}
        submitError={submitError}
        isSubmitting={isSubmitting}
      />

      {/* Bottom-left hamburger menu */}
      <HamburgerMenu
        isSignedIn={isSignedIn}
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
