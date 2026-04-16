'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Upload, Trash2, Users, Download, AlertCircle, Edit2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { loadFaceApiModelWeights, loadImageFromUrl } from '@/lib/face-api-models'

interface StudentData {
  studentId: string
  studentName: string
  rollNumber?: string | null
  email?: string | null
  parentContact?: string | null
  imageData?: string
  uploadedAt: string
  embedding?: number[]
}

interface AvailableStudent {
  id: string
  name: string
  rollNumber?: string | null
  email?: string | null
  parentContact?: string | null
}

export function StudentDatasetManager() {
  const [students, setStudents] = useState<StudentData[]>([])
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [modelsReady, setModelsReady] = useState(false)
  const [modelLoadError, setModelLoadError] = useState<string | null>(null)
  const [modelsLoadedFrom, setModelsLoadedFrom] = useState<string | null>(null)
  const [singlePhotoPreview, setSinglePhotoPreview] = useState<string | null>(null)
  const faceapiRef = useRef<null | typeof import("@vladmandic/face-api")>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const singleFileRef = useRef<HTMLInputElement>(null)

  const [editStudentId, setEditStudentId] = useState<string | null>(null)
  const [editStudentName, setEditStudentName] = useState<string>('')
  const [editRollNumber, setEditRollNumber] = useState<string>('')
  const [editEmail, setEditEmail] = useState<string>('')
  const [editParentContact, setEditParentContact] = useState<string>('')
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    studentId: "",
    studentName: "",
    rollNumber: "",
    email: "",
    parentContact: "",
  })
  const [studentSearch, setStudentSearch] = useState("")
  const [selectedStudentOption, setSelectedStudentOption] = useState("")

  // Load face-api models once
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const faceapi = await import("@vladmandic/face-api")
        faceapiRef.current = faceapi
        const { base } = await loadFaceApiModelWeights(faceapi)
        if (!cancelled) {
          setModelsReady(true)
          setModelLoadError(null)
          setModelsLoadedFrom(base)
        }
      } catch (e) {
        console.error("[v0] Failed to load face models:", e)
        if (!cancelled) {
          setModelsReady(false)
          setModelLoadError(e instanceof Error ? e.message : String(e))
          setModelsLoadedFrom(null)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Load students from DB (source of truth)
  useEffect(() => {
    const loadDb = async () => {
      try {
        const res = await fetch("/api/students/dataset?includeImages=1")
        const json = (await res.json()) as { ok: boolean; data?: StudentData[] }
        if (res.ok && json.ok && Array.isArray(json.data)) {
          setStudents(json.data)
        }
      } catch (e) {
        // ignore
      }
    }
    loadDb()
  }, [])

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const fetchStudents = async () => {
          const res = await fetch("/api/students")
          const json = (await res.json()) as { ok: boolean; data?: AvailableStudent[] }
          if (res.ok && json.ok && Array.isArray(json.data)) return json.data
          return []
        }

        let studentsFromDb = await fetchStudents()

        // Backfill DB from legacy browser storage once, so dropdown works after resets.
        if (studentsFromDb.length === 0) {
          try {
            const adminDataRaw = localStorage.getItem("adminData")
            if (adminDataRaw) {
              const adminData = JSON.parse(adminDataRaw)
              const importRes = await fetch("/api/db/import-localstorage", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  adminData,
                  camerasData: [],
                  attendanceRecords: [],
                  studentDataset: [],
                }),
              })
              const importJson = (await importRes.json().catch(() => null)) as { ok?: boolean } | null
              if (importRes.ok && importJson?.ok) {
                studentsFromDb = await fetchStudents()
              }
            }
          } catch {
            // ignore import fallback failures
          }
        }

        setAvailableStudents(studentsFromDb)
      } catch {
        // ignore
      }
    }
    loadStudents()
  }, [])

  useEffect(() => {
    return () => {
      if (singlePhotoPreview) URL.revokeObjectURL(singlePhotoPreview)
    }
  }, [singlePhotoPreview])

  useEffect(() => {
    return () => {
      if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview)
    }
  }, [editPhotoPreview])

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setIsUploading(true)
    setUploadStatus('Processing files...')

    try {
      if (!modelsReady || !faceapiRef.current) {
        setUploadStatus("Face models not loaded. Add models to /public/models and refresh.")
        return
      }
      const newStudents: Array<Omit<StudentData, "uploadedAt"> & { uploadedAt?: string }> = []

      for (const file of Array.from(files)) {
        // Parse filename format: "StudentID_StudentName.jpg"
        const filename = file.name.replace(/\.[^/.]+$/, '')
        const [studentId, ...nameParts] = filename.split('_')
        const studentName = nameParts.join(' ') || 'Unknown'

        const imageData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (event) => resolve(event.target?.result as string)
          reader.onerror = () => reject(new Error("Failed to read image"))
          reader.readAsDataURL(file)
        })

        const embedding = await generateFaceEmbedding(imageData)
        if (!embedding) {
          console.warn("[v0] No face detected for", file.name)
          continue
        }

        newStudents.push({
          studentId: studentId || `STU${Date.now()}`,
          studentName,
          imageData,
          embedding,
        })
      }

      if (newStudents.length > 0) {
        for (const s of newStudents) {
          const res = await fetch("/api/students/dataset", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              studentId: s.studentId,
              studentName: s.studentName,
              imageData: s.imageData,
              embedding: s.embedding,
            }),
          })
          const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
          if (!res.ok || !json?.ok) {
            throw new Error(json?.error || "Failed to save student embedding")
          }
        }
      }

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Refresh from DB
      const listRes = await fetch("/api/students/dataset?includeImages=1")
      const listJson = (await listRes.json()) as { ok: boolean; data?: StudentData[] }
      if (listRes.ok && listJson.ok && Array.isArray(listJson.data)) setStudents(listJson.data)

      if (newStudents.length === 0 && files.length > 0) {
        setUploadStatus(
          "No faces were saved. Use one clear face per photo, filename like ID_Name.jpg, and wait until models are ready.",
        )
        setTimeout(() => setUploadStatus(""), 8000)
      } else if (newStudents.length > 0) {
        setUploadStatus(`Successfully uploaded ${newStudents.length} student(s)`)
        setTimeout(() => setUploadStatus(""), 3000)
      }
    } catch (error) {
      console.error('[v0] Upload error:', error)
      setUploadStatus('Error uploading files')
    } finally {
      setIsUploading(false)
    }
  }

  const generateFaceEmbedding = async (imageData: string): Promise<number[] | null> => {
    const faceapi = faceapiRef.current
    if (!faceapi) return null

    const img = await loadImageFromUrl(imageData)
    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!detection?.descriptor) return null
    return Array.from(detection.descriptor)
  }

  const addSingleStudent = async () => {
    const studentId = form.studentId.trim()
    const studentName = form.studentName.trim()
    const rollNumber = form.rollNumber.trim()
    const email = form.email.trim()
    const parentContact = form.parentContact.trim()

    if (!studentId || !studentName) {
      setUploadStatus("Please select a student from the dropdown first.")
      return
    }
    if (!modelsReady || !faceapiRef.current) {
      setUploadStatus("Face models not loaded. Add models to /public/models and refresh.")
      return
    }

    const file = singleFileRef.current?.files?.[0]
    if (!file) {
      setUploadStatus("Please choose a student photo.")
      return
    }

    setIsUploading(true)
    setUploadStatus("Processing student photo...")

    try {
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => reject(new Error("Failed to read image"))
        reader.readAsDataURL(file)
      })

      const embedding = await generateFaceEmbedding(imageData)
      if (!embedding) {
        setUploadStatus("No face detected in that image. Please use a clearer front-facing photo.")
        return
      }

      const res = await fetch("/api/students/dataset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          studentName,
          rollNumber: rollNumber || null,
          email,
          parentContact,
          imageData,
          embedding,
        }),
      })

      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to save student")

      // Refresh from DB
      const listRes = await fetch("/api/students/dataset?includeImages=1")
      const listJson = (await listRes.json()) as { ok: boolean; data?: StudentData[] }
      if (listRes.ok && listJson.ok && Array.isArray(listJson.data)) setStudents(listJson.data)

      setForm({ studentId: "", studentName: "", rollNumber: "", email: "", parentContact: "" })
      if (singleFileRef.current) singleFileRef.current.value = ""
      if (singlePhotoPreview) URL.revokeObjectURL(singlePhotoPreview)
      setSinglePhotoPreview(null)

      setUploadStatus("Student saved to database.")
      setTimeout(() => setUploadStatus(""), 2500)
    } catch (e: any) {
      setUploadStatus(e?.message ?? "Failed to save student")
    } finally {
      setIsUploading(false)
    }
  }

  const onPickStudent = (studentId: string) => {
    setSelectedStudentOption(studentId)
    const selected = availableStudents.find((s) => s.id === studentId)
    if (!selected) return

    setForm({
      studentId: selected.id,
      studentName: selected.name,
      rollNumber: selected.rollNumber ?? "",
      email: selected.email ?? "",
      parentContact: selected.parentContact ?? "",
    })
  }

  const filteredStudents = availableStudents.filter((s) => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return true
    return (
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      String(s.rollNumber ?? "")
        .toLowerCase()
        .includes(q)
    )
  })

  const removeStudent = (studentId: string) => {
    const remove = async () => {
      try {
        const res = await fetch("/api/students/dataset/delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ studentId }),
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to delete student dataset")

        const listRes = await fetch("/api/students/dataset?includeImages=1")
        const listJson = (await listRes.json()) as { ok: boolean; data?: StudentData[] }
        if (listRes.ok && listJson.ok && Array.isArray(listJson.data)) setStudents(listJson.data)
      } catch (e: any) {
        setUploadStatus(e?.message ?? "Failed to delete student dataset")
        setTimeout(() => setUploadStatus(''), 2500)
      }
    }

    void remove()
  }

  const startEdit = (student: StudentData) => {
    setEditStudentId(student.studentId)
    setEditStudentName(student.studentName)
    setEditRollNumber(student.rollNumber ?? '')
    setEditEmail(student.email ?? '')
    setEditParentContact(student.parentContact ?? '')
    setEditFile(null)
    setEditPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const saveEdit = async () => {
    if (!editStudentId) return

    const studentId = editStudentId
    const studentName = editStudentName.trim()
    const rollNumber = editRollNumber.trim()
    const email = editEmail.trim()
    const parentContact = editParentContact.trim()

    if (!studentName || !rollNumber || !email || !parentContact) {
      setUploadStatus('Please fill Student Name, Registration Number, Email, and Cell Number.')
      return
    }

    setIsUploading(true)
    setUploadStatus(editFile ? 'Updating student face...' : 'Updating student details...')

    try {
      if (editFile) {
        if (!modelsReady || !faceapiRef.current) {
          throw new Error('Face models not loaded. Add models to /public/models and refresh.')
        }

        const imageData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.onerror = () => reject(new Error('Failed to read image'))
          reader.readAsDataURL(editFile)
        })

        const embedding = await generateFaceEmbedding(imageData)
        if (!embedding) {
          throw new Error('No face detected in that image. Please use a clearer photo.')
        }

        const res = await fetch("/api/students/dataset", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            studentId,
            studentName,
            rollNumber: rollNumber ? rollNumber : null,
            email,
            parentContact,
            imageData,
            embedding,
          }),
        })

        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to update student face')
      } else {
        const res = await fetch("/api/students/dataset/update-meta", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            studentId,
            studentName,
            rollNumber: rollNumber ? rollNumber : null,
            email,
            parentContact,
          }),
        })

        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to update student details')
      }

      // Refresh from DB
      const listRes = await fetch("/api/students/dataset?includeImages=1")
      const listJson = (await listRes.json()) as { ok: boolean; data?: StudentData[] }
      if (listRes.ok && listJson.ok && Array.isArray(listJson.data)) setStudents(listJson.data)

      setUploadStatus('Student updated.')
      setEditStudentId(null)
      setEditFile(null)
      setEditPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setTimeout(() => setUploadStatus(''), 2000)
    } catch (e: any) {
      setUploadStatus(e?.message ?? 'Failed to update student.')
    } finally {
      setIsUploading(false)
    }
  }

  const exportDataset = () => {
    const exportData = students.map((s) => ({
      studentId: s.studentId,
      studentName: s.studentName,
      uploadedAt: s.uploadedAt,
    }))
    const dataStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `student-dataset-${Date.now()}.json`
    a.click()
  }

  const clearAllStudents = () => {
    const clear = async () => {
      try {
        const res = await fetch("/api/students/dataset/clear", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to clear student dataset")

        const listRes = await fetch("/api/students/dataset?includeImages=1")
        const listJson = (await listRes.json()) as { ok: boolean; data?: StudentData[] }
        if (listRes.ok && listJson.ok && Array.isArray(listJson.data)) setStudents(listJson.data)

        setUploadStatus('Dataset cleared')
        setTimeout(() => setUploadStatus(''), 2000)
      } catch (e: any) {
        setUploadStatus(e?.message ?? "Failed to clear student dataset")
        setTimeout(() => setUploadStatus(''), 2500)
      }
    }

    if (confirm('Are you sure? This will delete all student dataset (faces) from the database.')) {
      void clear()
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Student Dataset Manager
        </h3>

        {modelLoadError && (
          <Alert className="mb-4 border-destructive/50 bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{modelLoadError}</span>
          </Alert>
        )}

        {modelsReady && modelsLoadedFrom && (
          <p className="text-xs text-foreground/60 mb-3">
            Face models ready (source: <code className="text-[11px] bg-muted px-1 rounded">{modelsLoadedFrom}</code>
            ).
          </p>
        )}

        {uploadStatus && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            {uploadStatus}
          </Alert>
        )}

        <div className="space-y-4">
          {/* Add Single Student */}
          <div className="rounded-lg border border-border p-4 bg-card/50 space-y-3">
            <h4 className="font-medium text-foreground">Add Student (recommended)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Search student by name, ID, or registration no"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <select
                value={selectedStudentOption}
                onChange={(e) => onPickStudent(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Select student from list</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} | ID: {s.id} | Reg: {s.rollNumber ?? "N/A"}
                  </option>
                ))}
              </select>
            </div>
            {availableStudents.length === 0 ? (
              <p className="text-xs text-foreground/60">
                No students found in database. Add/import students first, then select from dropdown.
              </p>
            ) : null}
            {form.studentId ? (
              <div className="rounded-md border border-border bg-background/60 p-3 text-sm">
                <div className="font-medium text-foreground">{form.studentName}</div>
                <div className="text-foreground/70">ID: {form.studentId}</div>
                <div className="text-foreground/70">Reg No: {form.rollNumber || "N/A"}</div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div className="w-full space-y-2">
                <input
                  ref={singleFileRef}
                  type="file"
                  accept="image/*"
                  disabled={isUploading}
                  className="w-full text-sm file:mr-2 file:rounded-md file:border file:border-border file:bg-card file:px-2 file:py-1"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setSinglePhotoPreview((prev) => {
                      if (prev) URL.revokeObjectURL(prev)
                      return f ? URL.createObjectURL(f) : null
                    })
                  }}
                />
                {singlePhotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={singlePhotoPreview}
                    alt="Selected photo preview"
                    className="max-h-40 rounded-md border border-border object-cover"
                  />
                ) : null}
              </div>
              <Button onClick={addSingleStudent} disabled={isUploading || !modelsReady} className="w-full sm:w-auto">
                {isUploading ? "Saving..." : "Save Student to Database"}
              </Button>
            </div>
            <p className="text-xs text-foreground/60">
              Tip: Use a clear, front-facing photo with good lighting. Re-upload updates the student’s face template.
            </p>
          </div>

          {/* Upload Section */}
          <label className="block border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              disabled={isUploading || !modelsReady}
              className="sr-only"
            />
            <Upload className="w-8 h-8 text-foreground/40 mx-auto mb-2" />
            <p className="text-foreground/60">Click to upload student photos</p>
            <p className="text-sm text-foreground/40">Format: StudentID_StudentName.jpg</p>
          </label>

          {/* Dataset Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-accent/10 p-4 rounded-lg">
              <div className="text-sm text-foreground/60">Total Students</div>
              <div className="text-2xl font-bold text-primary">{students.length}</div>
            </div>
            <div className="bg-accent/10 p-4 rounded-lg">
              <div className="text-sm text-foreground/60">Storage Used</div>
              <div className="text-2xl font-bold text-primary">
                {(students.length * 0.5).toFixed(1)} MB
              </div>
            </div>
          </div>

          {/* Student List */}
          {students.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <h4 className="font-medium text-foreground/80">Enrolled Students</h4>
              {students.map((student) => (
                <div
                  key={student.studentId}
                  className="flex items-center justify-between gap-3 bg-background/50 p-3 rounded border border-border/50 hover:border-primary/50 transition-colors"
                >
                  {student.imageData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={student.imageData}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-md object-cover border border-border"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-md bg-muted border border-border" aria-hidden />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">
                      {student.studentName}
                    </div>
                    <div className="text-xs text-foreground/60">ID: {student.studentId}</div>
                    <div className="text-xs text-foreground/60">
                      Roll: {student.rollNumber ? student.rollNumber : 'N/A'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(student)}
                      className="text-foreground/70 hover:text-foreground"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStudent(student.studentId)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {editStudentId && (
            <Card className="p-4 mt-4">
              <h4 className="font-medium text-foreground mb-3">Edit Student</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={editStudentName}
                    onChange={(e) => setEditStudentName(e.target.value)}
                    placeholder="Student name"
                  />
                  <Input value={editStudentId ?? ''} disabled />
                  <Input
                    value={editRollNumber}
                    onChange={(e) => setEditRollNumber(e.target.value)}
                    placeholder="Roll number"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Student email"
                  />
                  <Input
                    value={editParentContact}
                    onChange={(e) => setEditParentContact(e.target.value)}
                    placeholder="Student cell number"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-foreground/60">Optional: re-upload face image</div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      setEditFile(f)
                      setEditPhotoPreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev)
                        return f ? URL.createObjectURL(f) : null
                      })
                    }}
                    disabled={isUploading}
                    className="w-full text-sm"
                  />
                  {editPhotoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={editPhotoPreview}
                      alt="New photo preview"
                      className="max-h-36 rounded-md border border-border object-cover"
                    />
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={saveEdit}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    {isUploading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditStudentId(null)
                      setEditFile(null)
                      setEditPhotoPreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev)
                        return null
                      })
                    }}
                    disabled={isUploading}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              onClick={exportDataset}
              disabled={students.length === 0 || isUploading}
              variant="outline"
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Dataset
            </Button>
            <Button
              onClick={clearAllStudents}
              disabled={students.length === 0 || isUploading}
              variant="ghost"
              className="flex-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
