import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"

import { db, schema } from "@/lib/db"

type ImportPayload = {
  adminData?: unknown
  camerasData?: unknown
  attendanceRecords?: unknown
  studentDataset?: unknown
}

function safeJson<T>(value: unknown): T | undefined {
  return value as T
}

export async function POST(req: Request) {
  let payload: ImportPayload
  try {
    payload = (await req.json()) as ImportPayload
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const adminData = safeJson<{ classes?: any[]; students?: any[] }>(payload.adminData)
  const camerasData = safeJson<any[]>(payload.camerasData)
  const attendance = safeJson<any[]>(payload.attendanceRecords)
  const dataset = safeJson<any[]>(payload.studentDataset)

  try {
    // Drizzle's `db` instance in this project doesn't expose `transaction()`.
    // We perform the writes sequentially to keep the endpoint functional.
    if (adminData?.classes?.length) {
      for (const c of adminData.classes) {
        if (!c?.id) continue
        db.insert(schema.classes)
          .values({
            id: String(c.id),
            name: String(c.name ?? ""),
            classTeacher: String(c.classTeacher ?? ""),
            totalStudents: Number(c.totalStudents ?? 0) || 0,
            day: c.day ? String(c.day) : null,
            startTime: c.startTime ? String(c.startTime) : null,
            endTime: c.endTime ? String(c.endTime) : null,
          })
          .onConflictDoUpdate({
            target: schema.classes.id,
            set: {
              name: String(c.name ?? ""),
              classTeacher: String(c.classTeacher ?? ""),
              totalStudents: Number(c.totalStudents ?? 0) || 0,
              day: c.day ? String(c.day) : null,
              startTime: c.startTime ? String(c.startTime) : null,
              endTime: c.endTime ? String(c.endTime) : null,
            },
          })
          .run()

        if (Array.isArray(c.sections)) {
          for (const s of c.sections) {
            if (!s?.id) continue
            db.insert(schema.sections)
              .values({
                id: String(s.id),
                name: String(s.name ?? ""),
                classId: String(c.id),
              })
              .onConflictDoUpdate({
                target: schema.sections.id,
                set: { name: String(s.name ?? ""), classId: String(c.id) },
              })
              .run()
          }
        }
      }
    }

    if (adminData?.students?.length) {
      for (const s of adminData.students) {
        if (!s?.id) continue
        db.insert(schema.students)
          .values({
            id: String(s.id),
            name: String(s.name ?? ""),
            email: s.email ? String(s.email) : null,
            rollNumber: s.rollNumber ? String(s.rollNumber) : null,
            parentContact: s.parentContact ? String(s.parentContact) : null,
          })
          .onConflictDoUpdate({
            target: schema.students.id,
            set: {
              name: String(s.name ?? ""),
              email: s.email ? String(s.email) : null,
              rollNumber: s.rollNumber ? String(s.rollNumber) : null,
              parentContact: s.parentContact ? String(s.parentContact) : null,
            },
          })
          .run()

        const classIds: unknown = s.classIds ?? (s.classId ? [s.classId] : [])
        if (Array.isArray(classIds)) {
          for (const cid of classIds) {
            if (!cid) continue
            db.insert(schema.studentEnrollments)
              .values({ studentId: String(s.id), classId: String(cid) })
              .onConflictDoNothing()
              .run()
          }
        }
      }
    }

    if (Array.isArray(camerasData) && camerasData.length) {
      for (const cam of camerasData) {
        if (!cam?.id) continue
        const status = cam.status === "inactive" || cam.status === "offline" ? cam.status : "active"
        db.insert(schema.cameras)
          .values({
            id: String(cam.id),
            name: String(cam.name ?? ""),
            classId: String(cam.classId ?? ""),
            location: String(cam.location ?? ""),
            ipAddress: String(cam.ipAddress ?? ""),
            status,
            installDate: String(cam.installDate ?? new Date().toISOString().slice(0, 10)),
            model: String(cam.model ?? ""),
          })
          .onConflictDoUpdate({
            target: schema.cameras.id,
            set: {
              name: String(cam.name ?? ""),
              classId: String(cam.classId ?? ""),
              location: String(cam.location ?? ""),
              ipAddress: String(cam.ipAddress ?? ""),
              status,
              installDate: String(cam.installDate ?? new Date().toISOString().slice(0, 10)),
              model: String(cam.model ?? ""),
            },
          })
          .run()
      }
    }

    if (Array.isArray(attendance) && attendance.length) {
      for (const r of attendance) {
        if (!r?.studentId || !r?.classId || !r?.date) continue
        const status = r.status === "absent" || r.status === "late" ? r.status : "present"
        const method = r.method === "face_recognition" ? "face_recognition" : "manual"
        const markedAt = r.markedAt ? String(r.markedAt) : new Date().toISOString()

        // upsert by (studentId, classId, date)
        const existing = db
          .select({ id: schema.attendanceRecords.id })
          .from(schema.attendanceRecords)
          .where(
            and(
              eq(schema.attendanceRecords.studentId, String(r.studentId)),
              eq(schema.attendanceRecords.classId, String(r.classId)),
              eq(schema.attendanceRecords.date, String(r.date)),
            ),
          )
          .get()

        if (existing?.id) {
          db.update(schema.attendanceRecords)
            .set({ status, method, markedAt })
            .where(eq(schema.attendanceRecords.id, existing.id))
            .run()
        } else {
          db.insert(schema.attendanceRecords)
            .values({
              studentId: String(r.studentId),
              classId: String(r.classId),
              date: String(r.date),
              status,
              method,
              markedAt,
            })
            .run()
        }
      }
    }

    if (Array.isArray(dataset) && dataset.length) {
      const { syncPythonAttendanceImage } = await import("@/lib/sync-python-attendance-images")
      for (const d of dataset) {
        if (!d?.studentId || !d?.imageData) continue
        const hasEmbedding = Array.isArray(d.embedding) && d.embedding.length > 0
        try {
          db.insert(schema.studentDataset)
            .values({
              studentId: String(d.studentId),
              studentName: String(d.studentName ?? ""),
              imageData: String(d.imageData),
              uploadedAt: String(d.uploadedAt ?? new Date().toISOString()),
              embeddingJson: hasEmbedding ? JSON.stringify(d.embedding) : null,
            })
            .run()
        } catch {
          continue
        }
        if (!hasEmbedding) continue
        const saved = db
          .select({
            studentId: schema.studentDataset.studentId,
            studentName: schema.studentDataset.studentName,
            imageData: schema.studentDataset.imageData,
            rollNumber: schema.students.rollNumber,
          })
          .from(schema.studentDataset)
          .innerJoin(schema.students, eq(schema.studentDataset.studentId, schema.students.id))
          .where(eq(schema.studentDataset.studentId, String(d.studentId)))
          .get()
        if (saved?.imageData) {
          syncPythonAttendanceImage({
            studentId: saved.studentId,
            studentName: saved.studentName,
            rollNumber: saved.rollNumber,
            imageData: saved.imageData,
          })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Import failed" }, { status: 500 })
  }
}

