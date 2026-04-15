/**
 * Loads SSD MobileNet, landmarks, and face recognition weights.
 * Tries `/public/models` first, then the npm package CDN (for when only manifests exist locally).
 */
export async function loadFaceApiModelWeights(
  faceapi: typeof import("@vladmandic/face-api"),
): Promise<{ base: string }> {
  const tf = await import("@tensorflow/tfjs-core")
  await import("@tensorflow/tfjs-backend-webgl")
  await tf.setBackend("webgl")
  await tf.ready()

  const bases = ["/models", "https://unpkg.com/@vladmandic/face-api@1.7.15/model"] as const
  const errors: string[] = []

  for (const base of bases) {
    try {
      await faceapi.nets.ssdMobilenetv1.loadFromUri(base)
      await faceapi.nets.faceLandmark68Net.loadFromUri(base)
      await faceapi.nets.faceRecognitionNet.loadFromUri(base)
      return { base }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${base}: ${msg}`)
      console.warn("[face-api] loadFromUri failed:", base, e)
    }
  }

  throw new Error(
    `Face models failed to load (${errors.length} attempts). ` +
      `Add weight .bin files under public/models, or use online access for the CDN fallback.`,
  )
}

/** Load a data URL or blob URL into an HTMLImageElement for face-api detection. */
export function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not decode image"))
    img.src = src
  })
}
