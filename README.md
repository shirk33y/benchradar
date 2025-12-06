# BenchRadar

BenchRadar is a small location-based web app and PWA for discovering nearby benches (places to sit) on a map. It is designed primarily to be installed as a web shortcut on iOS ("Add to Home Screen"), but works as a regular mobile-first website as well.

The core idea: users can see benches around them on a map, and authenticated users can propose new benches by uploading photos. Admins moderate new benches before they become visible to everyone.

---

## High-level Product Overview

- **Home screen:**
  - A full-screen map (OpenStreetMap or Google Maps), centered on the user’s approximate location (with permission).
  - Markers on the map show **approved benches**.
  - Each bench marker displays a small **thumbnail of the main bench photo** when possible.

- **Bench details:**
  - Tapping a bench marker opens a bottom sheet or modal with:
    - Main bench photo (larger view).
    - Optional description.
    - Additional photos (gallery).
    - Basic info (approximate address, distance from the user, creation date, etc.).

- **Adding a bench:**
  - A floating **`+` button in the bottom-right corner** of the screen.
  - Only visible / enabled for authenticated users.
  - Pressing `+` opens a flow to:
    - **Take a new photo** or **upload an existing one** from the device.
    - Optionally add **more photos** (one main + additional ones).
    - Optionally type a **short textual description**.
  - The backend will attempt to **read GPS metadata (EXIF)** from the main photo to determine the bench location.
    - If GPS data is missing or invalid, the UI can later offer a manual map picker (future enhancement).
  - The newly submitted bench goes into a **pending moderation queue**.

- **Moderation workflow:**
  - New benches are stored with status `pending`.
  - **Admin users** can:
    - Review the pending benches list.
    - Adjust metadata (e.g. description, coordinates).
    - Approve or reject a bench.
  - Once approved, a bench becomes **visible on the public map**.

- **Default map zoom behavior:**
  - On initial load, the map should be zoomed so that:
    - The **user’s location** is roughly at the center.
    - The **nearest approved bench** is somewhere near the edge of the viewport.
  - If no benches exist yet, show a reasonable default zoom around the user.

---

## User Roles & Permissions

BenchRadar distinguishes three main audiences:

1. **Anonymous visitors** (no sign-in)
   - Can view the map.
   - Can see **only approved benches** and their details.
   - Cannot create benches.

2. **Authenticated users (role: `user`)**
   - Authenticate via **Google OAuth** (Supabase Auth).
   - Can create new benches:
     - Upload/take photos.
     - Provide optional description.
   - Their benches are initially `pending` and are not publicly visible until an admin approves them.

3. **Admins (role: `admin`)**
   - Also authenticate via Google OAuth.
   - Have access to an **admin moderation interface**.
   - Can:
     - List benches by status (`pending`, `approved`, `rejected`).
     - Edit bench metadata (e.g. title/description, coordinates).
     - Approve, reject or delete benches.
   - Admin status is stored in the database (e.g. `profiles.role = 'admin'`).

All end-user access is read from Supabase via RLS-controlled queries. Anonymous users should effectively have **read-only access** to approved public data.

---

## Architecture Overview

- **Frontend:**
  - **Deno**-based toolchain/runtime.
  - **React 19** for the UI.
  - **Tailwind CSS v4** for styling.
  - **Zustand** for client-side state management (filters, current user, benches cache, etc.).
  - Built as a **PWA** and deployed as static assets to **GitHub Pages**.

- **Backend:**
  - **Supabase** project providing:
    - PostgreSQL database.
    - Row-Level Security (RLS).
    - Auth with **Google OAuth** as the primary provider.
    - Storage for bench photos in a **Supabase Storage bucket** (for example `bench-photos`), served directly via public URLs/CDN, while the database only stores **lightweight paths/URLs**.
  - Public, anonymous **read-only access** is enforced by RLS policies, not by exposing write operations.

- **Client–Backend interaction:**
  - Frontend uses the Supabase JS client in the browser (with an **anon key** or modern publishable key) for:
    - Fetching approved benches & photos.
    - Auth flows (sign in with Google).
    - Authenticated bench creation.
  - Sensitive operations (e.g. moderation) are protected via RLS and role checks.

---

## Supabase Data Model (Draft)

**1. `profiles`**

Stores app-specific data for each authenticated user. Typically linked 1:1 with `auth.users`.

Suggested columns (simplified):

- `id` – UUID, primary key, references `auth.users.id`.
- `email` – text, optional convenience copy of user email.
- `role` – text, enum-like: `'user' | 'admin'`.
- `created_at` – timestamptz.

Usage:

- After Google sign-in, ensure a profile row exists.
- Admins are distinguished by `role = 'admin'`.

**2. `benches`**

Represents a single bench location.

Suggested columns:

- `id` – UUID, primary key.
- `created_by` – UUID, references `profiles.id` (nullable for system-created seed data).
- `status` – text: `'pending' | 'approved' | 'rejected'`.
- `title` – short text (optional; could be omitted for MVP).
- `description` – text (optional).
- `latitude` / `longitude` – numeric (e.g. `double precision` or `numeric(9,6)`).
- `main_photo_url` – text, public URL or storage path for the main photo.
- `created_at` – timestamptz.
- `updated_at` – timestamptz.

**3. `bench_photos`** (optional but recommended)

Separate table for additional photos per bench.

Suggested columns:

- `id` – UUID, primary key.
- `bench_id` – UUID, references `benches.id`.
- `url` – text, public URL or storage path.
- `is_main` – boolean; exactly one per bench should be true (or we rely on `benches.main_photo_url`).
- `created_at` – timestamptz.

In many cases, `benches.main_photo_url` is enough for MVP, with `bench_photos` added later for richer galleries.

---

## Access Control & RLS (Conceptual)

RLS (Row-Level Security) policies on Supabase will ensure that:

- **Anonymous (no auth):**
  - `SELECT` from `benches` where `status = 'approved'`.
  - `SELECT` from `bench_photos` joined to approved benches.
  - No `INSERT`, `UPDATE`, or `DELETE` permissions.

- **Authenticated normal user (`profiles.role = 'user'`):**
  - Same read access as anonymous users for public data.
  - `INSERT` into `benches` and `bench_photos` for new benches they create.
  - Optionally may `UPDATE` or `DELETE` their own benches while status is `pending`.

- **Admin (`profiles.role = 'admin'`):**
  - `SELECT` all benches, regardless of status.
  - `INSERT`, `UPDATE`, `DELETE` on `benches` and `bench_photos`.
  - Can change `status` from `pending` to `approved` or `rejected`.

These rules are implemented in the database, so even if the client is compromised, data integrity is still protected by Supabase.

---

## Image Storage & Processing

- Bench photos are stored in a **Supabase Storage bucket** (for example `bench-photos`).
- Database tables (`benches`, `bench_photos`) store **only public URLs/paths** to images instead of binary blobs.
- When a user selects or takes a photo on iOS or Android, the **frontend converts and compresses the image on the client side** before upload:
  - Image is decoded into a canvas (or equivalent API) in the browser.
  - Resized so that the longest edge is roughly **Full HD (~1920px)** to avoid unnecessarily large files.
  - Exported as **WebP** when supported by the browser; otherwise exported as **JPEG** with a reasonable quality setting.
  - This keeps uploads fast and reduces storage usage while preserving enough detail to inspect a bench.
- After upload to the bucket, the app stores only the returned storage path/URL in `benches.main_photo_url` or `bench_photos.url`.

---

## Frontend Implementation Notes

- **Tech stack:**
  - Deno for tooling/runtime.
  - React 19 with functional components and hooks.
  - Tailwind CSS v4 for utility-first styling.
  - Zustand for lightweight global state (auth user, benches cache, filters, map viewport, etc.).
  - Supabase JS client for interacting with the Supabase backend from the browser.

- **Tooling & libraries:**
  - **Vite** as the dev server and bundler, using the official React + SWC plugin.
  - **Tailwind CSS via `@tailwindcss/vite`** for first-class integration with Vite.
  - **React Router** for lightweight routing (e.g. main map view + simple admin/moderation screens).
  - **react-leaflet + Leaflet** as the initial map solution, using **OpenStreetMap tiles** by default (with room to add Google Maps later if needed).
  - **Supabase JS client (`@supabase/supabase-js`)** for auth, database, and storage access.
  - **Client-side image processing** using a modern browser image compression/resizing library (for example a small wrapper around Canvas/Web APIs or a library like `browser-image-compression`) to convert uploads to WebP/JPEG and downscale to Full HD before upload.
  - **PWA tooling** using a Vite PWA plugin (for example `vite-plugin-pwa`) to generate the web app manifest and service worker.
  - Optional headless UI helpers (for example `@headlessui/react`) for accessible dialogs, lists, and menus while keeping full control over the iOS-inspired visual styling.

- **PWA / iOS considerations:**
  - Web App Manifest with name, icons, theme color, display mode.
  - Service worker for basic offline caching (at least shell + previously loaded data).
  - Layout and controls optimized for small touch screens.
  - Clear guidance for iOS users to **Add to Home Screen**.

- **UX & visual style:**
  - Very **simple, clean and distraction-free UI**, optimized for one-handed mobile use.
  - Minimize the number of required interactions: a single primary action (the `+` button) for adding benches and short, linear flows with as few steps as possible.
  - Hide non-essential options behind bottom sheets or menus so the **map stays the main focus**.
  - Overall look and feel inspired by **built-in iOS apps**: large tappable controls, smooth animations, subtle blur and rounded corners.
  - Where feasible within web constraints, mimic an **iOS 26-style “liquid”/aqua appearance** for key controls (buttons, bottom sheet handles, toggles) using gradients, translucency, and soft shadows.

- **Map integration:**
  - The initial implementation will choose either OpenStreetMap (via a JS library) or Google Maps.
  - Map component derives center/zoom from:
    - User geolocation (if granted).
    - Nearest approved bench (for zoom extent).
  - Benches are rendered as markers with optional thumbnails.

---

## Future Enhancements (Non-blocking)

- Manual map-based location selection if EXIF GPS is missing.
- Simple search/filter (e.g. only show benches within X km).
- Reporting inappropriate benches/photos.
- Multiple languages (initial docs and UI in English).

---

## Repository & Deployment

- **GitHub repository:** `shirk33y/benchradar`.
- **Frontend:** built as a static site (React + Tailwind + Zustand) and deployed to **GitHub Pages**.
- **Backend:** single Supabase project hosting database, Auth, and storage.

This README describes the product and technical vision. Implementation details (schema migrations, RLS policies, and deployment scripts) will be added as the project evolves.
