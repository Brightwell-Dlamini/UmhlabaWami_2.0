import { getSupabase } from '../lib/supabase';

const MAX_BYTES = {
  'shop-images': 5 * 1024 * 1024,
  'org-logos': 2 * 1024 * 1024,
  'ticket-attachments': 5 * 1024 * 1024,
  'lease-documents': 10 * 1024 * 1024,
} as const;

export type BucketName = keyof typeof MAX_BYTES;

interface UploadArgs {
  bucket: BucketName;
  organizationId: string;
  /** Entity the file belongs to, e.g. shop id, ticket id. */
  entityId: string;
  file: File;
}

/**
 * Upload a file to a bucket. Path convention:
 *   {organizationId}/{entityId}/{timestamp}-{safeName}
 * Returns the public URL (or signed path) for storage in DB rows.
 */
export async function uploadFile({
  bucket,
  organizationId,
  entityId,
  file,
}: UploadArgs): Promise<{ path: string; publicUrl: string | null }> {
  const max = MAX_BYTES[bucket];
  if (file.size > max) {
    throw new Error(
      `File "${file.name}" exceeds max size for ${bucket} (${Math.round(max / 1024 / 1024)}MB).`
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${organizationId}/${entityId}/${Date.now()}-${safeName}`;

  const sb = getSupabase();
  const { error } = await sb.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;

  if (bucket === 'shop-images' || bucket === 'org-logos') {
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  }

  return { path, publicUrl: null };
}

/**
 * Get a signed URL (for private buckets).
 */
export async function getSignedUrl(
  bucket: BucketName,
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete one or more files from a bucket.
 */
export async function deleteFiles(bucket: BucketName, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const sb = getSupabase();
  const { error } = await sb.storage.from(bucket).remove(paths);
  if (error) throw error;
}
