import { supabase } from '@/lib/supabase'

/** Private Storage bucket holding gold bills (see migration 16). */
const RECEIPTS_BUCKET = 'receipts'

/** Extensions we allow, matched to the bucket's allowed MIME types. */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** Human list of accepted bill types, for the file input + error copy. */
export const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024 // 10 MB (matches the bucket)

/** True when a file is an accepted bill type within the size limit. */
export function isAcceptedReceipt(file: File): boolean {
  return file.type in EXT_BY_MIME && file.size <= RECEIPT_MAX_BYTES
}

/**
 * Upload a bill to '{familyId}/gold/{uuid}.{ext}' and return the object path.
 * The path's first segment is the family id so Storage RLS can scope access.
 */
export async function uploadGoldReceipt(
  familyId: string,
  file: File,
): Promise<string> {
  const ext = EXT_BY_MIME[file.type] ?? 'bin'
  const path = `${familyId}/gold/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw error
  return path
}

/**
 * A short-lived signed URL for viewing/downloading a stored bill (private
 * bucket, so a plain public URL won't work).
 */
export async function getGoldReceiptUrl(
  path: string,
  expiresInSeconds = 120,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds)

  if (error) throw error
  return data.signedUrl
}

/** Remove a stored bill (best-effort; ignores "not found"). */
export async function deleteGoldReceipt(path: string): Promise<void> {
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([path])
  if (error) throw error
}
