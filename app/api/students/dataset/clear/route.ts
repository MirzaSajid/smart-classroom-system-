import { NextResponse } from "next/server"

import { eq } from "drizzle-orm"

import { db, schema } from "@/lib/db"
import { slugForPythonFilename } from "@/lib/python-attendance-filename"
import { removePythonAttendanceImageFile } from "@/lib/sync-python-attendance-images"

export async function POST() {
  try {
    const rows = db
      .select({
        studentId: schema.studentDataset.studentId,
        studentName: schema.studentDataset.studentName,
        rollNumber: schema.students.rollNumber,
      })
      .from(schema.studentDataset)
      .leftJoin(schema.students, eq(schema.studentDataset.studentId, schema.students.id))
      .all()

    for (const r of rows) {
      const rollRaw = String(r.rollNumber ?? r.studentId).replace(/[^\w\d-]/g, "") || "0"
      removePythonAttendanceImageFile(rollRaw, slugForPythonFilename(r.studentName))
    }

    db.delete(schema.studentDataset).run()
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to clear student dataset" }, { status: 500 })
  }
}

