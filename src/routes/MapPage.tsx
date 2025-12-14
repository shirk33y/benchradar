import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  divIcon,
  type LatLngExpression,
  type Map as LeafletMap,
} from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet-edgebuffer";
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
import { convertToWebp, toThumbnailUrl } from "../lib/imageProcessing";
import { extractGpsFromFiles } from "../lib/photoMetadata";
import { LAT_LNG_HINT, parseLatLngInput, formatLatLngInput } from "../lib/geo";

const DEFAULT_CENTER: LatLngExpression = [52.2297, 21.0122]; // Warsaw as a neutral default

type BenchPhotoRow = {
  bench_id: string;
  url: string;
  is_main: boolean | null;
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
      <div class="flex h-10 w-10 items-center justify-center rounded-[12px] border-2 border-white bg-slate-200 shadow-[0_0_0_2px_rgba(15,23,42,0.9)] overflow-hidden">
        <img
          src="${thumbUrl}"
          onerror="this.onerror=null;this.src='${url}'"
          class="block h-full w-full object-cover object-center"
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

const CHOOSE_MODE_ZOOM = 16;
const RECENTER_ZOOM = 16;

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
  const [locationInput, setLocationInput] = useState("");
  const [locationInputError, setLocationInputError] = useState<string | null>(
    null
  );
  const [locationInputDirty, setLocationInputDirty] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingBench, setEditingBench] = useState<Bench | null>(null);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
  const [removedExistingPhotoUrls, setRemovedExistingPhotoUrls] = useState<
    string[]
  >([]);
  const [previewState, setPreviewState] = useState<{
    photos: string[];
    index: number;
  } | null>(null);
  const [previewDragOffset, setPreviewDragOffset] = useState(0);
  const [previewSwipeOffset, setPreviewSwipeOffset] = useState(0);
  const [mapStyle, setMapStyle] = useState<"normal" | "satellite">("normal");
  const mapRef = useRef<LeafletMap | null>(null);
  const selectFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);
  const dragFromIndexRef = useRef<number | null>(null);
  const previewGestureRef = useRef<{
    startX: number;
    startY: number;
    direction: "horizontal" | "vertical" | null;
  } | null>(null);
  const { benches, setBenches } = useBenchStore();
  const navigate = useNavigate();

  const {
    addMode,
    setMenuOpen,
    setAddMode,
    setAuthMode,
  } = useMapUiStore();

  const isSignedIn = !!user;
  const userEmail = user?.email ?? null;
  const pendingFileList = pendingFiles ?? [];

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    setPendingFiles((prev) => [...(prev ?? []), ...incoming]);

    if (incoming.length > 0) {
      const gpsLocation = await extractGpsFromFiles(incoming);
      if (gpsLocation) {
        let applied = false;
        setChosenLocation((current) => {
          if (current) {
            return current;
          }
          applied = true;
          return gpsLocation;
        });

        if (applied) {
          const locationExpression: LatLngExpression = [
            gpsLocation[0],
            gpsLocation[1],
          ];
          setCenter(locationExpression);
          if (mapRef.current) {
            mapRef.current.setView({
              lat: gpsLocation[0],
              lng: gpsLocation[1],
            });
          }
          setLocationInput(formatLatLngInput(gpsLocation[0], gpsLocation[1]));
          setLocationInputDirty(false);
          setLocationInputError(null);
        }
      }
    }

    setAddMode("details");
  };

  const validateLocationInputValue = (value: string): string | null => {
    if (!value.trim()) {
      return LAT_LNG_HINT;
    }
    return parseLatLngInput(value) ? null : "Coordinates must be valid lat,lng values";
  };

  const handleLocationInputChange = (value: string) => {
    if (!locationInputDirty) {
      setLocationInputDirty(true);
    }
    setLocationInput(value);
    setLocationInputError(validateLocationInputValue(value));
  };

  const handleLocationInputBlur = () => {
    if (!locationInputDirty) {
      setLocationInputDirty(true);
    }

    const error = validateLocationInputValue(locationInput);
    setLocationInputError(error);
    if (error) {
      return;
    }

    const parsed = parseLatLngInput(locationInput);
    if (!parsed) return;

    const [lat, lng] = parsed;
    const location: LatLngExpression = [lat, lng];
    setChosenLocation(location);
    setCenter(location);
    setLocationInput(formatLatLngInput(lat, lng));
    if (mapRef.current) {
      mapRef.current.setView({ lat, lng });
    }
    setLocationInputError(null);
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

    const remainingExistingUrls = existingPhotoUrls;
    const hasExisting = remainingExistingUrls.length > 0;
    const hasNew = pendingFiles && pendingFiles.length > 0;

    if (!hasExisting && !hasNew) {
      setSubmitError("Add at least one photo.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const uploadedUrls: string[] = [];
      let mainPhotoUrl = remainingExistingUrls[0] ?? editingBench.mainPhotoUrl ?? null;

      if (pendingFiles && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const largeWebp = await convertToWebp(file, 900);
          const thumbWebp = await convertToWebp(file, 48);

          const id = crypto.randomUUID();
          const largePath = `${user.id}/${id}.webp`;
          const thumbPath = `${user.id}/${id}_thumb.webp`;

          const { error: uploadError } = await supabase.storage
            .from("bench_photos")
            .upload(largePath, largeWebp, {
              contentType: "image/webp",
              upsert: false,
            });

          if (uploadError) {
            setSubmitError("Uploading photos failed. Please try again.");
            return;
          }

          await supabase.storage
            .from("bench_photos")
            .upload(thumbPath, thumbWebp, {
              contentType: "image/webp",
              upsert: false,
            });

          const {
            data: { publicUrl },
          } = supabase.storage.from("bench_photos").getPublicUrl(largePath);

          uploadedUrls.push(publicUrl);
        }
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

      if (removedExistingPhotoUrls.length > 0) {
        await supabase
          .from("bench_photos")
          .delete()
          .eq("bench_id", editingBench.id)
          .in("url", removedExistingPhotoUrls);
      }

      if (uploadedUrls.length > 0) {
        const photoRows = uploadedUrls.map((url) => ({
          bench_id: editingBench.id,
          url,
          is_main: mainPhotoUrl === url,
        }));

        await supabase.from("bench_photos").insert(photoRows);
      }

      const updatedPhotoUrls = [...remainingExistingUrls, ...uploadedUrls];

      setBenches(
        benches.map((b: Bench) =>
          b.id === editingBench.id
            ? {
                ...b,
                latitude: lat,
                longitude: lng,
                description: draftDescription || null,
                mainPhotoUrl,
                photoUrls: updatedPhotoUrls,
              }
            : b
        )
      );

      setAddMode("idle");
      setEditingBench(null);
      setPendingFiles(null);
      setDraftDescription("");
      setChosenLocation(null);
      setExistingPhotoUrls([]);
      setRemovedExistingPhotoUrls([]);
      setLocationInput("");
      setLocationInputDirty(false);
      setLocationInputError(null);
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

    setBenches(benches.filter((b: Bench) => b.id !== bench.id));
    setAddMode("idle");
    setEditingBench(null);
    setPendingFiles(null);
    setDraftDescription("");
    setChosenLocation(null);
    setLocationInput("");
    setSubmitError(null);
    setExistingPhotoUrls([]);
    setRemovedExistingPhotoUrls([]);
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

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}`,
      },
    });
    if (error) {
      setAuthError("Google sign-in failed. Please try again.");
      setAuthLoading(false);
    }
    // On success, Supabase redirects away, so no need to reset loading here.
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
    setLocationInput(formatLatLngInput(bench.latitude, bench.longitude));
    setLocationInputDirty(false);
    setLocationInputError(null);
    setPendingFiles(null);
    setSubmitError(null);
    setExistingPhotoUrls(
      bench.photoUrls && bench.photoUrls.length > 0
        ? bench.photoUrls
        : bench.mainPhotoUrl
        ? [bench.mainPhotoUrl]
        : []
    );
    setRemovedExistingPhotoUrls([]);
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
    setLocationInput(formatLatLngInput(location[0], location[1]));
    setLocationInputDirty(false);
    setLocationInputError(null);
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

  const resetPreviewGesture = (
    target?: EventTarget & Element,
    pointerId?: number
  ) => {
    if (target && typeof target.releasePointerCapture === "function" && pointerId !== undefined) {
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        // ignore release errors
      }
    }
    previewGestureRef.current = null;
    setPreviewDragOffset(0);
    setPreviewSwipeOffset(0);
  };

  const handlePreviewPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewState) return;
    previewGestureRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      direction: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePreviewPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewState) return;
    const gesture = previewGestureRef.current;
    if (!gesture) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.direction) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        return;
      }
      gesture.direction = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      previewGestureRef.current = gesture;
    }

    if (gesture.direction === "horizontal") {
      event.preventDefault();
      setPreviewSwipeOffset(dx);
    } else {
      event.preventDefault();
      setPreviewDragOffset(Math.max(dy, 0));
    }
  };

  const handlePreviewPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewState) {
      resetPreviewGesture(event.currentTarget, event.pointerId);
      return;
    }
    const gesture = previewGestureRef.current;
    if (!gesture) {
      resetPreviewGesture(event.currentTarget, event.pointerId);
      return;
    }

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (gesture.direction === "horizontal" && Math.abs(dx) > 80) {
      showRelativePreviewPhoto(dx > 0 ? -1 : 1);
    } else if (gesture.direction === "vertical" && dy > 120) {
      closePhotoPreview();
    }

    resetPreviewGesture(event.currentTarget, event.pointerId);
  };

  const handlePreviewPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    resetPreviewGesture(event.currentTarget, event.pointerId);
  };

  useEffect(() => {
    if (!previewState) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePhotoPreview();
      } else if (event.key === "ArrowRight") {
        showRelativePreviewPhoto(1);
      } else if (event.key === "ArrowLeft") {
        showRelativePreviewPhoto(-1);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [previewState]);

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
        const largeWebp = await convertToWebp(file, 900);
        const thumbWebp = await convertToWebp(file, 48);

        const id = crypto.randomUUID();
        const largePath = `${user.id}/${id}.webp`;
        const thumbPath = `${user.id}/${id}_thumb.webp`;

        const { error: uploadError } = await supabase.storage
          .from("bench_photos")
          .upload(largePath, largeWebp, {
            contentType: "image/webp",
            upsert: false,
          });

        if (uploadError) {
          setSubmitError("Uploading photos failed. Please try again.");
          return;
        }

        await supabase.storage
          .from("bench_photos")
          .upload(thumbPath, thumbWebp, {
            contentType: "image/webp",
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
      setLocationInput("");
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

  const handleRemoveExistingPhoto = (index: number) => {
    setExistingPhotoUrls((current) => {
      if (index < 0 || index >= current.length) {
        return current;
      }
      const removedUrl = current[index];
      if (removedUrl) {
        setRemovedExistingPhotoUrls((prev) =>
          prev.includes(removedUrl) ? prev : [...prev, removedUrl]
        );
      }
      const next = current.filter((_, i) => i !== index);
      return next;
    });
  };

  const openPhotoPreview = (photos: string[], startIndex = 0) => {
    if (!photos || photos.length === 0) return;
    const clampedIndex = Math.min(Math.max(startIndex, 0), photos.length - 1);
    setPreviewState({
      photos,
      index: clampedIndex,
    });
    setPreviewDragOffset(0);
    setPreviewSwipeOffset(0);
  };

  const closePhotoPreview = () => {
    setPreviewState(null);
    setPreviewDragOffset(0);
    setPreviewSwipeOffset(0);
  };

  const showRelativePreviewPhoto = (delta: number) => {
    setPreviewState((current) => {
      if (!current || current.photos.length === 0) {
        return current;
      }
      const nextIndex =
        (current.index + delta + current.photos.length) %
        current.photos.length;
      return { ...current, index: nextIndex };
    });
  };

  const closeAnyPopup = () => {
    if (mapRef.current) {
      mapRef.current.closePopup();
    }
  };

  const handleRecenterOnUser = () => {
    if (!userLocation || !mapRef.current) return;
    closeAnyPopup();
    mapRef.current.setView(userLocation as any, RECENTER_ZOOM, { animate: true });
    setCenter(userLocation);
  };

  const handleToggleMapStyle = () => {
    closeAnyPopup();
    setMapStyle((prev) => (prev === "normal" ? "satellite" : "normal"));
  };

    const fetchBenchesForCurrentBounds = async (_mapOverride?: LeafletMap) => {
    const { data: benchesData, error: benchesError } = await supabase
      .from("benches")
      .select(
        "id, latitude, longitude, title, description, main_photo_url, status, created_by"
      );

    if (benchesError || !benchesData) {
      return;
    }

    let photoMap: Record<string, string[]> = {};
    if (benchesData.length > 0) {
      const benchIds = benchesData.map((row) => row.id);
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
          })
        );
      }
    }

    const mappedBenches = benchesData.map((row) => {
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
        createdBy: row.created_by,
      };
    });

    setBenches(mappedBenches);
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
      setPendingFiles(null);
      setDraftDescription("");
      setChosenLocation(null);
      setLocationInput("");
      setSubmitError(null);
      setExistingPhotoUrls([]);
      setRemovedExistingPhotoUrls([]);
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

  useEffect(() => {
    if (!isAdmin) return;
    const stored = sessionStorage.getItem("admin_edit_bench");
    if (!stored) return;
    try {
      const parsed: Bench = JSON.parse(stored);
      const existing = benches.find((b) => b.id === parsed.id);
      if (existing) {
        startEditingBench(existing);
        sessionStorage.removeItem("admin_edit_bench");
      }
    } catch {
      sessionStorage.removeItem("admin_edit_bench");
    }
  }, [benches, isAdmin]);

  const mapCenter = center;

  const handleStartChoosingLocation = () => {
    const map = mapRef.current;
    if (!map) {
      setAddMode("choosing-location");
      return;
    }

    const parsedFromInput = parseLatLngInput(locationInput);
    const target =
      parsedFromInput ??
      (chosenLocation && Array.isArray(chosenLocation)
        ? ([chosenLocation[0], chosenLocation[1]] as [number, number])
        : userLocation && Array.isArray(userLocation)
        ? ([userLocation[0], userLocation[1]] as [number, number])
        : null);

    if (target) {
      map.closePopup();
      map.setView({ lat: target[0], lng: target[1] }, CHOOSE_MODE_ZOOM, {
        animate: true,
      });
      setChosenLocation([target[0], target[1]]);
      setLocationInput(formatLatLngInput(target[0], target[1]));
      setLocationInputDirty(false);
      setLocationInputError(null);
    }

    setAddMode("choosing-location");
  };

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-slate-950">
      <MapContainer
        center={mapCenter}
        zoom={14}
        scrollWheelZoom
        preferCanvas
        zoomAnimation
        className="z-0 h-full w-full"
        ref={mapRef}
        whenReady={() => {
          const mapInstance = mapRef.current;
          if (!mapInstance) return;
          void fetchBenchesForCurrentBounds(mapInstance);
          mapInstance.on("moveend", () => {
            void fetchBenchesForCurrentBounds(mapInstance);
          });
        }}
      >
        {mapStyle === "normal" ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
            tileSize={256}
            detectRetina
            keepBuffer={5}
            edgeBufferTiles={2}
            updateWhenIdle={false}
            updateWhenZooming
            updateInterval={80}
            minZoom={3}
            maxZoom={19}
            crossOrigin
          />
        ) : (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            tileSize={256}
            detectRetina
            keepBuffer={5}
            edgeBufferTiles={2}
            updateWhenIdle={false}
            updateWhenZooming
            updateInterval={80}
            minZoom={3}
            maxZoom={19}
            crossOrigin
          />
        )}

        {userLocation && <Marker position={userLocation} icon={userIcon} />}

        {benches.map((bench: Bench) => {
          const popupPhotos =
            bench.photoUrls && bench.photoUrls.length > 0
              ? bench.photoUrls
              : bench.mainPhotoUrl
              ? [bench.mainPhotoUrl]
              : [];

          return (
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
                {popupPhotos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {popupPhotos.map((url, _index) => (
                      <button
                        key={`${url}-${_index}`}
                        type="button"
                        className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white/40 shadow"
                        onClick={() => openPhotoPreview(popupPhotos, _index)}
                      >
                        <img
                          src={url}
                          alt={bench.description ?? "Bench photo"}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
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
                {isAdmin && bench.status === "pending" && (
                  <div className="mt-1 inline-flex self-start rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                    Pending
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
        })}
      </MapContainer>

      {/* Map style + recenter controls */}
      <div className="pointer-events-none absolute right-3 top-24 z-[1000] flex flex-col items-end gap-2">
        {/* Circular Map / Satellite toggle button */}
        <button
          type="button"
          onClick={handleToggleMapStyle}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md shadow-slate-900/40 transition active:scale-95 active:bg-slate-100"
        >
          {mapStyle === "normal" ? (
            <img
              src="/satellite.svg"
              alt="Enable satellite view"
              className="h-6 w-6"
              draggable={false}
            />
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
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md shadow-slate-900/40 transition active:scale-95 active:bg-slate-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="relative top-0.5 h-5 w-5 text-slate-800"
            >
              <path d="M3 10 21 3l-7 18-3.5-7.5L3 10Z" />
            </svg>
          </button>
        )}
      </div>

      {previewState && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm"
          onClick={closePhotoPreview}
        >
          <div
            className="relative flex w-full max-w-4xl flex-col items-center px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-6 top-6 z-[2100] flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-slate-900 shadow"
              onClick={closePhotoPreview}
            >
              ×
            </button>
            <div
              className="relative mt-8 flex w-full flex-col items-center"
              onPointerDown={handlePreviewPointerDown}
              onPointerMove={handlePreviewPointerMove}
              onPointerUp={handlePreviewPointerUp}
              onPointerCancel={handlePreviewPointerCancel}
            >
              {previewState.photos.length > 1 && previewState.index > 0 && (
                <>
                  <button
                    type="button"
                    className="absolute left-0 top-0 z-[2040] h-full w-1/2 cursor-pointer text-transparent"
                    onClick={(event) => {
                      event.stopPropagation();
                      showRelativePreviewPhoto(-1);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="absolute left-3 top-1/2 z-[2050] flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-lg"
                    onClick={(event) => {
                      event.stopPropagation();
                      showRelativePreviewPhoto(-1);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="h-8 w-8 text-slate-900"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 6 9 12 15 18" />
                    </svg>
                  </button>
                </>
              )}
              {previewState.photos.length > 1 &&
                previewState.index < previewState.photos.length - 1 && (
                  <>
                    <button
                      type="button"
                      className="absolute right-0 top-0 z-[2040] h-full w-1/2 cursor-pointer text-transparent"
                      onClick={(event) => {
                        event.stopPropagation();
                        showRelativePreviewPhoto(1);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 z-[2050] flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-lg"
                      onClick={(event) => {
                        event.stopPropagation();
                        showRelativePreviewPhoto(1);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="h-8 w-8 text-slate-900"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 6 15 12 9 18" />
                      </svg>
                    </button>
                  </>
                )}
              <div
                className="relative w-full overflow-hidden rounded-2xl bg-black/40 shadow-2xl"
                style={{
                  height: "min(80vh, 900px)",
                  transform: `translateY(${previewDragOffset}px)`,
                  transition: previewDragOffset === 0 ? "transform 0.2s ease-out" : "none",
                }}
              >
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    transform: `translateX(${previewSwipeOffset}px)`,
                    transition: previewSwipeOffset === 0 ? "transform 0.2s ease-out" : "none",
                  }}
                >
                  <img
                    src={previewState.photos[previewState.index]}
                    alt="Bench preview"
                    className="max-h-full w-full object-contain"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm text-slate-100">
                <span>
                  {previewState.index + 1}/{previewState.photos.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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
        locationInput={locationInput}
        onLocationInputChange={handleLocationInputChange}
        onLocationInputBlur={handleLocationInputBlur}
        onStartChoosingLocation={handleStartChoosingLocation}
        locationInputError={locationInputError}
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
        onFabPress={closeAnyPopup}
        existingPhotoUrls={existingPhotoUrls}
        canDelete={
          !!editingBench &&
          (isAdmin || (!!user && editingBench.createdBy === user.id))
        }
        onDeleteBench={
          editingBench
            ? () => {
                void handleDeleteBench(editingBench);
              }
            : undefined
        }
        onRemoveExistingPhoto={editingBench ? handleRemoveExistingPhoto : undefined}
        submitError={submitError}
        isSubmitting={isSubmitting}
      />

      {/* Bottom-left hamburger menu */}
      <HamburgerMenu
        isSignedIn={isSignedIn}
        isAdmin={isAdmin}
        userEmail={userEmail}
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
        handleGoogleSignIn={handleGoogleSignIn}
      />
    </div>
  );
}
