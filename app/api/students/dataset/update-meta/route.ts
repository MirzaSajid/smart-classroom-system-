import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { db, schema } from "@/lib/db"
import { slugForPythonFilename } from "@/lib/python-attendance-filename"
import { removePythonAttendanceImageFile, syncPythonAttendanceImage } from "@/lib/sync-python-attendance-images"

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const studentId = String(body.studentId || "").trim()
  const studentName = String(body.studentName || "").trim()
  const rollNumber =
    body.rollNumber !== undefined && body.rollNumber !== null ? String(body.rollNumber).trim() : null
  const email = body.email ? String(body.email).trim() : null
  const parentContact = body.parentContact ? String(body.parentContact).trim() : null

  if (!studentId || !studentName) {
    return NextResponse.json({ ok: false, error: "studentId and studentName are required" }, { status: 400 })
  }

  try {
    const before = db
      .select({
        studentName: schema.studentDataset.studentName,
        rollNumber: schema.students.rollNumber,
      })
      .from(schema.studentDataset)
      .innerJoin(schema.students, eq(schema.studentDataset.studentId, schema.students.id))
      .where(eq(schema.studentDataset.studentId, studentId))
      .get()

    // Update enrollment roster fields (students table)
    db.update(schema.students)
      .set({ name: studentName, rollNumber, email, parentContact })
      .where(eq(schema.students.id, studentId))
      .run()

    // Update face template metadata (student_dataset table)
    db.update(schema.studentDataset)
      .set({ studentName })
      .where(eq(schema.studentDataset.studentId, studentId))
      .run()

    const after = db
      .select({
        studentName: schema.studentDataset.studentName,
        imageData: schema.studentDataset.imageData,
        rollNumber: schema.students.rollNumber,
      })
      .from(schema.studentDataset)
      .innerJoin(schema.students, eq(schema.studentDataset.studentId, schema.students.id))
      .where(eq(schema.studentDataset.studentId, studentId))
      .get()

    if (before) {
      const oldRoll = String(before.rollNumber ?? studentId).replace(/[^\w\d-]/g, "") || "0"
      removePythonAttendanceImageFile(oldRoll, slugForPythonFilename(before.studentName))
    }
    if (after?.imageData) {
      syncPythonAttendanceImage({
        studentId,
        studentName: after.studentName,
        rollNumber: after.rollNumber,
        imageData: after.imageData,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to update student" }, { status: 500 })
  }
}

