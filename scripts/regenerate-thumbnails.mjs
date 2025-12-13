/* eslint-disable no-console */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = "bench_photos";
const THUMB_SIZE = 48;
const CHUNK_SIZE = 10;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const tempDir = fs.mkdtempSync(path.join(process.cwd(), "bench-thumb-"));
const cleanup = () => {
  fs.rmSync(tempDir, { recursive: true, force: true });
};
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(1);
});

function isThumb(filePath) {
  return filePath.includes("_thumb.");
}

function thumbPathFromFull(pathStr) {
  if (isThumb(pathStr)) return pathStr;
  const dot = pathStr.lastIndexOf(".");
  if (dot === -1) return `${pathStr}_thumb.webp`;
  return `${pathStr.slice(0, dot)}_thumb${pathStr.slice(dot)}`;
}

function listBucketFiles({ offset = 0, limit = 100 }) {
  return supabase.storage.from(BUCKET).list("", {
    offset,
    limit,
    sortBy: { column: "name", order: "asc" },
    search: ".",
  });
}

async function listAllFiles() {
  let offset = 0;
  const pageSize = 100;
  const files = [];
  // Supabase storage list is per-folder; to simplify, rely on pagination and search
  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(undefined, {
        offset,
        limit: pageSize,
        sortBy: { column: "name", order: "asc" },
        search: ".",
      });
    if (error) throw error;
    if (!data || data.length === 0) break;
    files.push(...data);
    offset += data.length;
  }
  return files;
}

function bucketPathFromEntry(entry) {
  if (entry.name && !entry.id) {
    // root file
    return entry.name;
  }
  // entries might not include full path; use entry.id if available
  return entry.id ?? entry.name;
}

async function listThumbTargets() {
  const { data, error } = await supabase
    .from("bench_photos")
    .select("id, url");
  if (error) throw error;
  return data ?? [];
}

function bucketPathFromUrl(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

async function downloadFile(storagePath, destPath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw error ?? new Error("Download failed");
  }
  fs.writeFileSync(destPath, Buffer.from(await data.arrayBuffer()));
}

async function uploadThumb(storagePath, buffer) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/webp",
      upsert: true,
    });
  if (error) throw error;
}

async function regenerateThumb(row) {
  const storagePath = bucketPathFromUrl(row.url);
  if (!storagePath) {
    console.warn("Skipping row", row.id, "(could not parse storage path)");
    return;
  }
  const sourcePath = storagePath.replace(/_thumb\.[^.]+$/i, (match) => match.replace("_thumb", ""));
  const localFile = path.join(tempDir, path.basename(sourcePath));
  await downloadFile(sourcePath, localFile);

  const thumbBuffer = await sharp(localFile)
    .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "cover" })
    .webp({ quality: 70 })
    .toBuffer();

  const thumbStoragePath = thumbPathFromFull(sourcePath);
  await uploadThumb(thumbStoragePath, thumbBuffer);

  console.log("Regenerated thumb", thumbStoragePath);
}

async function main() {
  const rows = await listThumbTargets();
  console.log(`Regenerating thumbs for ${rows.length} photo rows.`);
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(regenerateThumb));
  }
  console.log("Done regenerating thumbnails.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
