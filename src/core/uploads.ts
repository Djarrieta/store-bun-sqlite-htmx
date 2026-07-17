/**
 * Image upload validation + storage (tech-spec §8.3).
 * Type is detected by MAGIC BYTES (never the client content-type/extension).
 * Only raster jpeg/png/webp; SVG rejected. Destination filename is app-generated.
 */
import { mkdir } from "node:fs/promises";
import { newId } from "../db.ts";

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

const EXT: Record<ImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Detect a raster image type by magic bytes, or null if unsupported. */
export function detectImageType(bytes: Uint8Array): ImageMime | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  // WEBP: "RIFF"...."WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

export interface SaveResult {
  ok: boolean;
  /** App path relative to the destination base (e.g. filename). */
  filename?: string;
  mime?: ImageMime;
  error?: string;
}

/**
 * Validate a File (from multipart form) and save it under `destDir`.
 * Returns the generated filename (not a full URL).
 */
export async function saveImage(
  file: File,
  destDir: string,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<SaveResult> {
  if (!file || file.size === 0) return { ok: false, error: "Archivo vacío." };
  if (file.size > maxBytes) return { ok: false, error: "La imagen supera el tamaño máximo." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectImageType(bytes);
  if (!mime) return { ok: false, error: "Formato no permitido. Usa JPG, PNG o WEBP." };

  await mkdir(destDir, { recursive: true });
  const filename = `${newId()}.${EXT[mime]}`;
  await Bun.write(`${destDir}/${filename}`, bytes);
  return { ok: true, filename, mime };
}
