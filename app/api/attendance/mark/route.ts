import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"

import { db, schema } from "@/lib/db"

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const studentId = String(body.studentId || "").trim()
  const classId = String(body.classId || "").trim()
  const date = String(body.date || "").trim()
  const status = body.status === "absent" || body.status === "late" ? body.status : "present"
  const method = body.method === "face_recognition" ? "face_recognition" : "manual"
  const markedAt = body.markedAt ? String(body.markedAt) : new Date().toISOString()
  const confidence = typeof body.confidence === "number" && Number.isFinite(body.confidence) ? body.confidence : 0

  if (!studentId || !classId || !date) {
    return NextResponse.json({ ok: false, error: "studentId, classId, date are required" }, { status: 400 })
  }

  try {
    // Upsert by (studentId, classId, date)
    const existing = db
      .select({ id: schema.attendanceRecords.id })
      .from(schema.attendanceRecords)
      .where(
        and(
          eq(schema.attendanceRecords.studentId, studentId),
          eq(schema.attendanceRecords.classId, classId),
          eq(schema.attendanceRecords.date, date),
        ),
      )
      .get()

    if (existing?.id) {
      db.update(schema.attendanceRecords)
        .set({ status, method, markedAt, confidence })
        .where(eq(schema.attendanceRecords.id, existing.id))
        .run()
    } else {
      db.insert(schema.attendanceRecords)
        .values({ studentId, classId, date, status, method, markedAt, confidence })
        .run()
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to mark attendance" }, { status: 500 })
  }
}

