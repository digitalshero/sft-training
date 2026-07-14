// ── File upload helper — uses signed PUT URL from backend ─────────────────
import api from "./client";

/**
 * Upload a file to S3 via the backend's signed upload URL endpoint.
 * Works in both local (multipart POST) and S3 (presigned PUT) modes.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File | Blob,
): Promise<null | string> {
  try {
    // 1. Get a signed upload URL (or local upload endpoint) from the backend
    const { data } = await api.post("/sft/storage/signed-upload-url", { bucket, path });

    if (data.signedUrl.startsWith("/api/")) {
      // Local dev mode: POST multipart to our own backend
      const form = new FormData();
      form.append("file", file);
      await fetch(data.signedUrl, { method: "POST", body: form });
    } else {
      // S3 presigned PUT
      await fetch(data.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file instanceof File ? file.type : "application/octet-stream" },
      });
    }
    return null; // null = no error, matching Supabase convention
  } catch (err) {
    return err instanceof Error ? err.message : "Upload failed";
  }
}

/**
 * Get a signed URL for reading a file.
 */
export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  try {
    const { data } = await api.post("/sft/storage/signed-url", { bucket, path });
    return data?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * For public-facing image uploads (S3 path → CDN/signed URL).
 * Returns the path stored in the DB, not the URL.
 */
export async function uploadImageAndGetPath(
  bucket: string,
  folder: string,
  file: File,
): Promise<{ path: string; url: string } | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const err = await uploadToStorage(bucket, path, file);
  if (err) return null;
  const url = await getSignedUrl(bucket, path);
  return url ? { path, url } : null;
}
