import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db, schema } from "@/lib/db"

type SessionStudent = {
  id?: string
  studentId?: string
  status?: "present" | "absent" | "late" | "unmarked" | string
}

type MarkedStudent = {
  id?: string
  markedAt?: string | Date
  confidence?: number
  method?: "face_recognition" | "manual" | string
}

export async function POST(request: Request) {
  try {
    const { classId, className, startTime, endTime, markedStudents, allStudents } = await request.json()
    const safeClassId = String(classId || "").trim()
    const safeClassName = String(className || "").trim()
    const safeMarked = Array.isArray(markedStudents) ? (markedStudents as MarkedStudent[]) : []
    const safeAllStudents = Array.isArray(allStudents) ? (allStudents as SessionStudent[]) : []

    if (!safeClassId) {
      return NextResponse.json({ ok: false, error: "classId is required" }, { status: 400 })
    }

    console.log("[v0] Attendance session saved:", {
      classId: safeClassId,
      className: safeClassName,
      startTime,
      endTime,
      totalStudents: safeMarked.length,
    })

    // Build per-student save payload from current session state.
    const today = new Date().toISOString().split('T')[0]
    const markedById = new Map<string, MarkedStudent>()
    for (const m of safeMarked) {
      const id = String(m?.id || "").trim()
      if (!id) continue
      markedById.set(id, m)
    }

    const recordsToPersist = safeAllStudents
      .map((student) => {
        const studentId = String(student?.id ?? student?.studentId ?? "").trim()
        if (!studentId) return null

        const statusRaw = String(student?.status || "unmarked").toLowerCase()
        if (statusRaw !== "present" && statusRaw !== "absent" && statusRaw !== "late") return null
        const status = statusRaw as "present" | "absent" | "late"

        const marked = markedById.get(studentId)
        const markedAt =
          marked?.markedAt != null ? new Date(marked.markedAt).toISOString() : new Date().toISOString()
        const method = marked?.method === "face_recognition" ? "face_recognition" : "manual"
        const confidence =
          typeof marked?.confidence === "number" && Number.isFinite(marked.confidence) ? marked.confidence : 0

        return { studentId, status, method, markedAt, confidence }
      })
      .filter(Boolean) as Array<{
      studentId: string
      status: "present" | "absent" | "late"
      method: "face_recognition" | "manual"
      markedAt: string
      confidence: number
    }>

    for (const record of recordsToPersist) {
      const existing = db
        .select({ id: schema.attendanceRecords.id })
        .from(schema.attendanceRecords)
        .where(
          and(
            eq(schema.attendanceRecords.studentId, record.studentId),
            eq(schema.attendanceRecords.classId, safeClassId),
            eq(schema.attendanceRecords.date, today),
          ),
        )
        .get()

      if (existing?.id) {
        db.update(schema.attendanceRecords)
          .set({
            status: record.status,
            method: record.method,
            markedAt: record.markedAt,
            confidence: record.confidence,
          })
          .where(eq(schema.attendanceRecords.id, existing.id))
          .run()
      } else {
        db.insert(schema.attendanceRecords)
          .values({
            studentId: record.studentId,
            classId: safeClassId,
            date: today,
            status: record.status,
            method: record.method,
            markedAt: record.markedAt,
            confidence: record.confidence,
          })
          .run()
      }
    }

    console.log(`[v0] Saved ${recordsToPersist.length} attendance records for ${safeClassName}`)

    return NextResponse.json({
      ok: true,
      sessionId: `session_${Date.now()}`,
      totalMarked: safeMarked.length,
      totalRecords: recordsToPersist.length,
      message: "Attendance session saved successfully",
    })
  } catch (error) {
    console.error("Session save error:", error)
    return NextResponse.json({ ok: false, error: "Failed to save session" }, { status: 500 })
  }
}
