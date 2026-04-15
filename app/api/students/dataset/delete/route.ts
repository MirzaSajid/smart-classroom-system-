import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { db, schema } from "@/lib/db"
import { slugForPythonFilename } from "@/lib/python-attendance-filename"
import { removePythonAttendanceImageFile } from "@/lib/sync-python-attendance-images"

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const studentId = String(body.studentId || "").trim()
  if (!studentId) {
    return NextResponse.json({ ok: false, error: "studentId is required" }, { status: 400 })
  }

  try {
    const row = db
      .select({
        studentName: schema.studentDataset.studentName,
        rollNumber: schema.students.rollNumber,
      })
      .from(schema.studentDataset)
      .leftJoin(schema.students, eq(schema.studentDataset.studentId, schema.students.id))
      .where(eq(schema.studentDataset.studentId, studentId))
      .get()

    if (row) {
      const rollRaw = String(row.rollNumber ?? studentId).replace(/[^\w\d-]/g, "") || "0"
      removePythonAttendanceImageFile(rollRaw, slugForPythonFilename(row.studentName))
    }

    // Remove the biometric template only (not the student record).
    // This keeps class enrollment/roster data intact.
    db.delete(schema.studentDataset).where(eq(schema.studentDataset.studentId, studentId)).run()
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to delete student dataset" },
      { status: 500 },
    )
  }
}

