export async function convertToWebp(
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
    canvas.toBlob((b) => resolve(b), "image/webp", 0.72)
  );

  if (!blob) {
    throw new Error("WEBP conversion failed");
  }

  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, "") + ".webp",
    { type: "image/webp" }
  );
}

export function toThumbnailUrl(url: string): string {
  const [base, query] = url.split("?", 2);
  const lastDot = base.lastIndexOf(".");
  if (lastDot === -1) return url;
  const withThumb = `${base.slice(0, lastDot)}_thumb${base.slice(lastDot)}`;
  return query ? `${withThumb}?${query}` : withThumb;
}
