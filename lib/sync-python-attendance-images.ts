import fs from "node:fs"
import path from "node:path"

import { slugForPythonFilename } from "@/lib/python-attendance-filename"

const PYTHON_IMAGES_REL = ["Facial Attendance System", "images"] as const

function pythonImagesDir(): string {
  return path.join(process.cwd(), ...PYTHON_IMAGES_REL)
}

function parseDataUrl(imageData: string): { buffer: Buffer; ext: string } | null {
  const m = imageData.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i)
  if (!m) return null
  const t = m[1].toLowerCase()
  const ext = t === "jpeg" || t === "jpg" ? "jpg" : t === "png" ? "png" : "webp"
  return { buffer: Buffer.from(m[2], "base64"), ext }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Remove training images for this roll + name slug (any extension). */
export function removePythonAttendanceImageFile(rollRaw: string, nameSlug: string): void {
  try {
    const dir = pythonImagesDir()
    if (!fs.existsSync(dir)) return
    const re = new RegExp(
      `^${escapeRe(rollRaw)}_${escapeRe(nameSlug)}\\.(jpg|jpeg|png|webp)$`,
      "i",
    )
    for (const f of fs.readdirSync(dir)) {
      if (re.test(f)) {
        fs.unlinkSync(path.join(dir, f))
      }
    }
  } catch {
    // ignore — optional local sync
  }
}

/**
 * Writes a face image next to program.py's expected folder so the desktop scanner stays in sync.
 * Best-effort only (local dev); fails silently if the path is missing or not writable.
 */
export function syncPythonAttendanceImage(input: {
  rollNumber: string | null | undefined
  studentId: string
  studentName: string
  imageData: string
}): void {
  try {
    const parsed = parseDataUrl(input.imageData)
    if (!parsed) return

    const rollRaw =
      String(input.rollNumber ?? input.studentId).replace(/[^\w\d-]/g, "") || "0"
    const slug = slugForPythonFilename(input.studentName)
    const dir = pythonImagesDir()
    fs.mkdirSync(dir, { recursive: true })

    removePythonAttendanceImageFile(rollRaw, slug)

    const filename = `${rollRaw}_${slug}.${parsed.ext}`
    fs.writeFileSync(path.join(dir, filename), parsed.buffer)
  } catch {
    // ignore — e.g. read-only deploy, wrong cwd
  }
}
