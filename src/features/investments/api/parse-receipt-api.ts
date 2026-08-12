import type { ParsedGoldReceipt } from '@/features/investments/gold-receipt-parse'

/**
 * Client for the /api/parse-gold-receipt serverless function (Gemini vision).
 * Only works where the function is deployed (Vercel) with GEMINI_API_KEY set —
 * a bare `vite dev` will 404, so callers must handle failure gracefully.
 */

/** Longest edge (px) we downscale images to before sending — keeps the request
 * small and well under serverless body limits; Gemini still reads them fine. */
const MAX_IMAGE_DIM = 1600
const JPEG_QUALITY = 0.85

/** Read a File as a base64 string (no data-URL prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })
}

/** Downscale an image and return JPEG base64 (smaller upload, faster parse). */
async function imageToJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(
    1,
    MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height),
  )
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas not supported')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

/** Turn a bill file into the { imageBase64, mimeType } the endpoint expects. */
async function toPayload(
  file: File,
): Promise<{ imageBase64: string; mimeType: string }> {
  if (file.type.startsWith('image/')) {
    return { imageBase64: await imageToJpegBase64(file), mimeType: 'image/jpeg' }
  }
  // PDFs (and anything else) go through untouched.
  return { imageBase64: await fileToBase64(file), mimeType: file.type }
}

/** Send a bill to Gemini (via our function) and get back structured fields. */
export async function parseGoldReceipt(
  file: File,
): Promise<ParsedGoldReceipt> {
  const payload = await toPayload(file)

  const response = await fetch('/api/parse-gold-receipt', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let message = `Bill reading failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // Non-JSON error (e.g. 404 under bare `vite dev`) — keep the generic msg.
    }
    throw new Error(message)
  }

  return (await response.json()) as ParsedGoldReceipt
}
