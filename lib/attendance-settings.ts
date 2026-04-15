export type AttendanceSettings = {
  /** 0..1 confidence threshold for auto-marking present */
  confidenceThreshold: number
  /** Minutes to keep the auto-mark window open */
  autoMarkAfterMinutes: number
  /** Face scan tick interval in milliseconds */
  detectionIntervalMs: number
}

const STORAGE_KEY = "attendanceSettings"

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  confidenceThreshold: 0.7,
  autoMarkAfterMinutes: 10,
  detectionIntervalMs: 1800,
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function sanitize(input: any): AttendanceSettings {
  const confidenceThresholdRaw = typeof input?.confidenceThreshold === "number" ? input.confidenceThreshold : undefined
  const autoMarkAfterMinutesRaw = typeof input?.autoMarkAfterMinutes === "number" ? input.autoMarkAfterMinutes : undefined
  const detectionIntervalMsRaw = typeof input?.detectionIntervalMs === "number" ? input.detectionIntervalMs : undefined

  const confidenceThreshold = clamp(
    Number.isFinite(confidenceThresholdRaw as any) ? (confidenceThresholdRaw as number) : DEFAULT_ATTENDANCE_SETTINGS.confidenceThreshold,
    0.4,
    0.95,
  )

  const autoMarkAfterMinutes = clamp(
    Number.isFinite(autoMarkAfterMinutesRaw as any) ? (autoMarkAfterMinutesRaw as number) : DEFAULT_ATTENDANCE_SETTINGS.autoMarkAfterMinutes,
    1,
    60,
  )

  const detectionIntervalMs = clamp(
    Number.isFinite(detectionIntervalMsRaw as any) ? (detectionIntervalMsRaw as number) : DEFAULT_ATTENDANCE_SETTINGS.detectionIntervalMs,
    500,
    10000,
  )

  return { confidenceThreshold, autoMarkAfterMinutes, detectionIntervalMs }
}

export function loadAttendanceSettings(): AttendanceSettings {
  if (typeof window === "undefined") return DEFAULT_ATTENDANCE_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_ATTENDANCE_SETTINGS
    return sanitize(JSON.parse(raw))
  } catch {
    return DEFAULT_ATTENDANCE_SETTINGS
  }
}

export function saveAttendanceSettings(next: AttendanceSettings) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(next)))
  } catch {
    // ignore
  }
}

