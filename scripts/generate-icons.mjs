#!/usr/bin/env node

import sharp from "sharp";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_SVG = resolve(__dirname, "../public/benchr-icon.svg");
const OUTPUT_DIR = resolve(__dirname, "../public/icons");

const SIZES = [64, 120, 152, 167, 180, 192, 256, 512, 1024];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const size of SIZES) {
    const outPath = resolve(OUTPUT_DIR, `icon-${size}.png`);
    console.log(`Generating ${outPath}...`);

    await sharp(INPUT_SVG)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(outPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
