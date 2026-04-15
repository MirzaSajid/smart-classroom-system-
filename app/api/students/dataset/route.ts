import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { db, schema } from "@/lib/db"
import { syncPythonAttendanceImage } from "@/lib/sync-python-attendance-images"

type DatasetRow = {
  studentId: string
  studentName: string
  rollNumber?: string | null
  email?: string | null
  parentContact?: string | null
  imageData?: string
  uploadedAt?: string
  embedding?: number[]
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const includeImages = url.searchParams.get("includeImages") === "1"

  const rows = db
    .select({
      studentId: schema.studentDataset.studentId,
      studentName: schema.studentDataset.studentName,
      rollNumber: schema.students.rollNumber,
      email: schema.students.email,
      parentContact: schema.students.parentContact,
      imageData: schema.studentDataset.imageData,
      uploadedAt: schema.studentDataset.uploadedAt,
      embeddingJson: schema.studentDataset.embeddingJson,
    })
    .from(schema.studentDataset)
    .leftJoin(schema.students, eq(schema.studentDataset.studentId, schema.students.id))
    .all()

  const data: DatasetRow[] = rows
    .map((r) => {
      const embedding = r.embeddingJson ? (JSON.parse(r.embeddingJson) as number[]) : undefined
      return {
        studentId: r.studentId,
        studentName: r.studentName,
        rollNumber: r.rollNumber,
        email: r.email,
        parentContact: r.parentContact,
        imageData: includeImages ? r.imageData : undefined,
        uploadedAt: r.uploadedAt,
        embedding,
      }
    })
    .filter((r) => Array.isArray(r.embedding) && r.embedding.length > 0)

  return NextResponse.json({ ok: true, data })
}

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const studentId = String(body.studentId || "").trim()
  const studentName = String(body.studentName || "").trim()

  // Only overwrite student metadata fields if they were actually provided by the client.
  // This prevents multi-upload/template updates from clearing previously stored email/cell/roll number.
  const rollNumberProvided = body.rollNumber !== undefined
  const emailProvided = body.email !== undefined
  const parentContactProvided = body.parentContact !== undefined

  const rollNumber = rollNumberProvided && body.rollNumber !== null && String(body.rollNumber).trim() !== ""
    ? String(body.rollNumber).trim()
    : null
  const email = emailProvided && body.email !== null && String(body.email).trim() !== "" ? String(body.email).trim() : null
  const parentContact =
    parentContactProvided && body.parentContact !== null && String(body.parentContact).trim() !== ""
      ? String(body.parentContact).trim()
      : null
  const imageData = String(body.imageData || "")
  const embedding = Array.isArray(body.embedding) ? (body.embedding as number[]) : null

  if (!studentId || !studentName || !imageData || !embedding || embedding.length === 0) {
    return NextResponse.json(
      { ok: false, error: "studentId, studentName, imageData, embedding are required" },
      { status: 400 },
    )
  }

  const uploadedAt = new Date().toISOString()
  const embeddingJson = JSON.stringify(embedding)

  try {
    // Drizzle's `db` instance in this project doesn't expose `transaction()`.
    // We perform the writes sequentially to keep the endpoint functional.
    db.insert(schema.students)
      .values({
        id: studentId,
        name: studentName,
        rollNumber: rollNumberProvided ? rollNumber : null,
        email: emailProvided ? email : null,
        parentContact: parentContactProvided ? parentContact : null,
      })
      .onConflictDoUpdate({
        target: schema.students.id,
        set: {
          name: studentName,
          ...(rollNumberProvided ? { rollNumber } : {}),
          ...(emailProvided ? { email } : {}),
          ...(parentContactProvided ? { parentContact } : {}),
        },
      })
      .run()

    // one row per studentId
    db.insert(schema.studentDataset)
      .values({
        studentId,
        studentName,
        imageData,
        uploadedAt,
        embeddingJson,
      })
      .onConflictDoUpdate({
        target: schema.studentDataset.studentId,
        set: { studentName, imageData, uploadedAt, embeddingJson },
      })
      .run()

    const saved = db
      .select({
        studentId: schema.studentDataset.studentId,
        studentName: schema.studentDataset.studentName,
        imageData: schema.studentDataset.imageData,
        rollNumber: schema.students.rollNumber,
      })
      .from(schema.studentDataset)
      .innerJoin(schema.students, eq(schema.studentDataset.studentId, schema.students.id))
      .where(eq(schema.studentDataset.studentId, studentId))
      .get()

    if (saved?.imageData) {
      syncPythonAttendanceImage({
        studentId: saved.studentId,
        studentName: saved.studentName,
        rollNumber: saved.rollNumber,
        imageData: saved.imageData,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to save dataset" }, { status: 500 })
  }
}

