import { useEffect, useRef, useState } from "react";
import {
  divIcon,
  type LatLngExpression,
  type Map as LeafletMap,
} from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet-edgebuffer";

import { useBenchStore } from "../store/useBenchStore";
import type { Bench } from "../store/useBenchStore";
import { useMapStore } from "../store/useMapStore";
import { MapHeader } from "../components/map/MapHeader";
import { HamburgerMenu } from "../components/map/HamburgerMenu";
import { AuthModal } from "../components/map/AuthModal";
import { AddBenchMenu } from "../components/map/AddBenchMenu";
import { useFullImagePreview } from "../hooks/useFullImagePreview";
import { FullImagePreview } from "../components/map/FullImagePreview";
import { BenchPopup } from "../components/map/BenchPopup";
import { fetchBenchesWithPhotos } from "../repositories/benchRepository";
import { toThumbnailUrl } from "../lib/imageProcessing";

const DEFAULT_CENTER: LatLngExpression = [52.2297, 21.0122]; // Warsaw as a neutral default

declare global {
  interface Window {
    __BENCHRADAR_MAP__?: LeafletMap;
  }
}

const approvedIcon = divIcon({
  className:
    "w-[18px] h-[18px] rounded-full border-2 border-slate-900/90 shadow-[0_0_0_2px_rgba(15,23,42,0.65)] bg-emerald-500",
  iconAnchor: [7, 7],
  iconSize: [14, 14],
});

function markerRingClass(status: Bench["status"]) {
  if (status === "pending") return "ring-amber-400";
  if (status === "rejected") return "ring-rose-500";
  return "ring-slate-900";
}

function createBenchPhotoIcon(url: string, status: Bench["status"]) {
  const ringClass = markerRingClass(status);
  const thumbUrl = toThumbnailUrl(url);
  return divIcon({
    className: "bench-photo-marker",
    html: `
      <div class="flex h-10 w-10 items-center justify-center rounded-[12px] border-2 border-white bg-white overflow-hidden ring-2 ${ringClass}">
        <img
          src="${thumbUrl}"
          loading="lazy"
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

const RECENTER_ZOOM = 16;

function useMapBridge(mapRef: React.MutableRefObject<LeafletMap | null>) {
  const mapInstance = useMap();
  const setMap = useMapStore((s) => s.setMap);

  useEffect(() => {
    mapRef.current = mapInstance;
    window.__BENCHRADAR_MAP__ = mapInstance;
    setMap(mapInstance);

    return;
  }, [mapInstance, mapRef, setMap]);
}

function MapBridge({
  mapRef,
}: {
  mapRef: React.MutableRefObject<LeafletMap | null>;
}) {
  useMapBridge(mapRef);

  return null;
}

export function MapPage() {
  const {
    initAuth,
    user,
    isAdmin,
    openSignIn,
    center,
    setCenter,
    userLocation,
    setUserLocation,
  } = useMapStore();

  const [mapStyle, setMapStyle] = useState<"normal" | "satellite">("normal");
  const mapRef = useRef<LeafletMap | null>(null);
  const benchIconCacheRef = useRef(new Map<string, ReturnType<typeof divIcon>>());
  const { benches, setBenches } = useBenchStore();

  useEffect(() => {
    const cleanup = initAuth();
    return () => cleanup?.();
  }, [initAuth]);

  const {
    previewState,
    previewDragOffset,
    previewSwipeOffset,
    open: openPhotoPreview,
    close: closePhotoPreview,
    showRelative: showRelativePreviewPhoto,
    handlePointerDown: handlePreviewPointerDown,
    handlePointerMove: handlePreviewPointerMove,
    handlePointerUp: handlePreviewPointerUp,
    handlePointerCancel: handlePreviewPointerCancel,
  } = useFullImagePreview();

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
    try {
      const mappedBenches = await fetchBenchesWithPhotos();
      setBenches(mappedBenches);
    } catch (_error) {
      // eslint-disable-next-line no-console
      console.error(_error);
      setBenches([]);
    }
  };

  const getBenchIcon = (bench: Bench) => {
    const key = `${bench.id}:${bench.mainPhotoUrl ?? ""}:${bench.status}`;
    const cached = benchIconCacheRef.current.get(key);
    if (cached) return cached;

    const icon = bench.mainPhotoUrl
      ? createBenchPhotoIcon(bench.mainPhotoUrl, bench.status)
      : bench.status === "pending"
        ? pendingIcon
        : bench.status === "rejected"
          ? rejectedIcon
          : approvedIcon;

    benchIconCacheRef.current.set(key, icon);
    return icon;
  };

  useEffect(() => {
    const nav = navigator as Navigator & { geolocation?: Geolocation };

    if ((import.meta as any).env?.VITE_E2E) {
      setCenter(DEFAULT_CENTER);
      return;
    }

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
    (async () => {
      await fetchBenchesForCurrentBounds();
    })();

    return () => {
      return;
    };
  }, [setBenches]);

  const mapCenter = center;

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-slate-950">
      <MapContainer
        center={mapCenter}
        zoom={14}
        scrollWheelZoom
        preferCanvas
        zoomAnimation={!(import.meta as any).env?.VITE_E2E}
        className="z-0 h-full w-full"
        ref={mapRef}
      >
        <MapBridge mapRef={mapRef} />
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

        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          zoomToBoundsOnClick
          maxClusterRadius={64}
        >
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
                title={bench.description ?? bench.id}
                icon={getBenchIcon(bench)}
              >
                <Popup
                  closeButton={false}
                  autoPan={!(import.meta as any).env?.VITE_E2E}
                >
                  <BenchPopup
                    bench={bench}
                    popupPhotos={popupPhotos}
                    isAdmin={isAdmin}
                    userId={user?.id ?? null}
                    openSignIn={openSignIn}
                    onOpenPhotoPreview={openPhotoPreview}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
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
        <FullImagePreview
          previewState={previewState}
          previewDragOffset={previewDragOffset}
          previewSwipeOffset={previewSwipeOffset}
          close={closePhotoPreview}
          showRelative={showRelativePreviewPhoto}
          onPointerDown={handlePreviewPointerDown}
          onPointerMove={handlePreviewPointerMove}
          onPointerUp={handlePreviewPointerUp}
          onPointerCancel={handlePreviewPointerCancel}
        />
      )}

      {/* Top iOS-like title bar */}
      <MapHeader />

      <AddBenchMenu />

      {/* Bottom-left hamburger menu */}
      <HamburgerMenu />

      <AuthModal />
    </div>
  );
}
