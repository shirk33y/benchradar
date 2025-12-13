/* eslint-disable no-console */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = "bench_photos";
const MAX_SIDE = 900;
const WEBP_QUALITY = 72;
const CHUNK_SIZE = 8;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const tempDir = fs.mkdtempSync(path.join(process.cwd(), "bench-webp-"));
const cleanup = () => {
  fs.rmSync(tempDir, { recursive: true, force: true });
};
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(1);
});

async function listBenchPhotos() {
  const { data, error } = await supabase
    .from("bench_photos")
    .select("id, url");
  if (error) throw error;
  return data ?? [];
}

function needsConversion(url) {
  return /\.jpe?g(\?|$)/i.test(url);
}

function toWebpUrl(url) {
  return url.replace(/\.jpe?g(\?.*)?$/i, ".webp$1");
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

async function reuploadWebp(storagePath, buffer) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/webp",
      upsert: true,
    });
  if (error) throw error;
}

async function updateDbUrl(id, newUrl) {
  const { error } = await supabase
    .from("bench_photos")
    .update({ url: newUrl })
    .eq("id", id);
  if (error) throw error;
}

async function convertOne(row) {
  const storagePath = bucketPathFromUrl(row.url);
  if (!storagePath) {
    console.warn("Skipping row", row.id, "(could not parse storage path)");
    return;
  }

  const localInput = path.join(tempDir, path.basename(storagePath));
  await downloadFile(storagePath, localInput);

  const converted = await sharp(localInput)
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const newStoragePath = storagePath.replace(/\.jpe?g$/i, ".webp");
  await reuploadWebp(newStoragePath, converted);

  const newUrl = toWebpUrl(row.url);
  await updateDbUrl(row.id, newUrl);

  console.log("Converted", storagePath, "→", newStoragePath);
}

async function main() {
  const rows = (await listBenchPhotos()).filter((row) => needsConversion(row.url));
  console.log(`Found ${rows.length} rows needing conversion.`);
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(convertOne));
  }
  console.log("Done converting existing photos to WebP.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
