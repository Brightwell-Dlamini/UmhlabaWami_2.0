// src/services/storage.ts
import { getSupabase } from '../lib/supabase';

interface BucketRules {
  maxBytes: number;
  /** Allowed MIME types. Use 'image/*' wildcard for image buckets. */
  allowedTypes: readonly string[];
}

const BUCKET_RULES = {
  'shop-images': {
    maxBytes: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  'org-logos': {
    maxBytes: 2 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  },
  'ticket-attachments': {
    maxBytes: 5 * 1024 * 1024,
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ],
  },
  'lease-documents': {
    maxBytes: 10 * 1024 * 1024,
    allowedTypes: ['application/pdf'],
  },
} as const satisfies Record<string, BucketRules>;

export type BucketName = keyof typeof BUCKET_RULES;

interface UploadArgs {
  bucket: BucketName;
  organizationId: string;
  /** Entity the file belongs to, e.g. shop id, ticket id. */
  entityId: string;
  file: File;
}

function typeAllowed(
  mime: string,
  allowed: readonly string[]
): boolean {
  if (allowed.includes(mime)) return true;
  return allowed.some((rule) => {
    if (rule.endsWith('/*')) {
      const prefix = rule.slice(0, -1); // keep the slash
      return mime.startsWith(prefix);
    }
    return false;
  });
}

/**
 * Upload a file to a bucket. Path convention:
 *   {organizationId}/{entityId}/{timestamp}-{safeName}
 * Returns the public URL (or signed path) for storage in DB rows.
 *
 * Throws if the file's size or MIME type violates the bucket's rules.
 */
export async function uploadFile({
  bucket,
  organizationId,
  entityId,
  file,
}: UploadArgs): Promise<{ path: string; publicUrl: string | null }> {
  const rules = BUCKET_RULES[bucket];
  const maxMb = Math.round(rules.maxBytes / 1024 / 1024);

  if (file.size > rules.maxBytes) {
    throw new Error(
      `File "${file.name}" exceeds max size for ${bucket} (${maxMb}MB).`
    );
  }
  if (!typeAllowed(file.type, rules.allowedTypes)) {
    const allowedList = rules.allowedTypes.join(', ');
    throw new Error(
      `File type "${file.type || 'unknown'}" is not allowed in ${bucket}. ` +
        `Accepted: ${allowedList}.`
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${organizationId}/${entityId}/${Date.now()}-${safeName}`;

  const sb = getSupabase();
  const { error } = await sb.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
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
  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete one or more files from a bucket.
 */
export async function deleteFiles(
  bucket: BucketName,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  const sb = getSupabase();
  const { error } = await sb.storage.from(bucket).remove(paths);
  if (error) throw error;
}
