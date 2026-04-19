/**
 * Normalize class names from Roboflow Universe, custom Roboflow projects,
 * or YOLO weights originally trained on COCO / Kaggle datasets (after upload to Roboflow Deploy).
 *
 * Add aliases here when your deployed model uses different label strings.
 */

const ALIAS_TO_CANONICAL: Record<string, string> = {
  // COCO & common vision labels → in-app behavior keys
  cell_phone: "phone_use",
  cellphone: "phone_use",
  mobile_phone: "phone_use",
  mobile_phone_device: "phone_use",
  smartphone: "phone_use",
  phone: "phone_use",
  iphone: "phone_use",
  android_phone: "phone_use",
  handphone: "phone_use",
  mobile: "phone_use",
  mobile_use: "phone_use",

  gun: "weapon",
  pistol: "weapon",
  handgun: "weapon",
  rifle: "weapon",
  revolver: "weapon",
  firearm: "weapon",
  knife: "weapon",
  blade: "weapon",
  machete: "weapon",
  sword: "weapon",
  weapon: "weapon",
}

function slugifyClass(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

/**
 * Map a raw model label to the internal behavior class used for alerts and UI.
 */
export function normalizeBehaviorClass(rawClass: string): string {
  if (!rawClass) return "unknown"
  const slug = slugifyClass(rawClass)
  if (!slug) return "unknown"
  return ALIAS_TO_CANONICAL[slug] ?? slug
}

/**
 * Roboflow hosted inference returns box center (x, y) and size in pixels relative to the inferred image.
 * Convert to top-left percentage (0–100) for the behavior monitor canvas overlay.
 */
export function normalizeBboxFromRoboflow(
  pred: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; width: number; height: number } {
  const iw = Math.max(1, imageWidth)
  const ih = Math.max(1, imageHeight)
  const halfW = pred.width / 2
  const halfH = pred.height / 2
  const left = pred.x - halfW
  const top = pred.y - halfH
  const clamp = (v: number) => Math.max(0, Math.min(100, v))
  return {
    x: clamp((left / iw) * 100),
    y: clamp((top / ih) * 100),
    width: clamp((pred.width / iw) * 100),
    height: clamp((pred.height / ih) * 100),
  }
}
