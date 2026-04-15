"use client"

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Camera, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import { loadFaceApiModelWeights, loadImageFromUrl } from '@/lib/face-api-models'

interface StudentBiometric {
  studentId: string
  studentName: string
  faceImage?: string
  embedding?: number[]
  capturedAt?: string
}

export function FacialRecognitionSetup() {
  const [students, setStudents] = useState<any[]>([])
  const [studentDataset, setStudentDataset] = useState<StudentBiometric[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string>('')
  const [manualStudentId, setManualStudentId] = useState<string>('')
  const [manualStudentName, setManualStudentName] = useState<string>('')
  const [useManualEntry, setUseManualEntry] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [modelsReady, setModelsReady] = useState(false)
  const faceapiRef = useRef<null | typeof import("@vladmandic/face-api")>(null)

  // Load students and existing biometric data
  useEffect(() => {
    const adminData = localStorage.getItem('adminData')
    if (adminData) {
      try {
        const data = JSON.parse(adminData)
        const classes = data.classes || []
        const allStudents = data.students || []
        
        // Filter students to only show those enrolled in existing classes
        const filteredStudents = allStudents.filter((student: any) => {
          const classIds = student.classIds || (student.classId ? [student.classId] : [])
          return classIds.some((cid: string) => classes.some((cls: any) => cls.id === cid))
        })
        
        setStudents(filteredStudents)
        console.log('[v0] Loaded', filteredStudents.length, 'students with active classes')
      } catch (e) {
        console.error('[v0] Failed to load admin data:', e)
      }
    }

    const loadBiometricsFromDb = async () => {
      try {
        const res = await fetch("/api/students/dataset?includeImages=1")
        const json = (await res.json()) as { ok: boolean; data?: any[] }
        if (res.ok && json.ok && Array.isArray(json.data)) {
          setStudentDataset(
            json.data.map((d: any) => ({
              studentId: String(d.studentId),
              studentName: String(d.studentName ?? ""),
              faceImage: d.imageData,
              embedding: d.embedding,
              capturedAt: d.uploadedAt,
            })),
          )
        }
      } catch (e) {
        console.error('[v0] Failed to load biometrics from DB:', e)
      }
    }

    loadBiometricsFromDb()
  }, [])

  // Load face-api models once
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const faceapi = await import("@vladmandic/face-api")
        faceapiRef.current = faceapi
        await loadFaceApiModelWeights(faceapi)
        if (!cancelled) setModelsReady(true)
      } catch (e) {
        console.error('[v0] Failed to load face models:', e)
        if (!cancelled) setModelsReady(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshStudentDatasetFromDb = async () => {
    try {
      const res = await fetch("/api/students/dataset?includeImages=1")
      const json = (await res.json()) as { ok: boolean; data?: any[] }
      if (res.ok && json.ok && Array.isArray(json.data)) {
        setStudentDataset(
          json.data.map((d: any) => ({
            studentId: String(d.studentId),
            studentName: String(d.studentName ?? ""),
            faceImage: d.imageData,
            embedding: d.embedding,
            capturedAt: d.uploadedAt,
          })),
        )
      }
    } catch (e) {
      console.error('[v0] Failed to refresh biometrics from DB:', e)
    }
  }

  // Initialize camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (err) {
      console.error('[v0] Camera error:', err)
      alert('Unable to access camera')
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
    }
    setCameraActive(false)
    setCapturedImage('')
  }

  // Capture face image
  const captureFace = async () => {
    if (!videoRef.current || !canvasRef.current) return

    // Validate inputs
    let studentId = ''
    let studentName = ''
    
    if (useManualEntry) {
      if (!manualStudentId || !manualStudentName) {
        alert('Please enter both Student ID and Student Name')
        return
      }
      studentId = manualStudentId
      studentName = manualStudentName
    } else {
      if (!selectedStudent) {
        alert('Please select a student')
        return
      }
      studentId = selectedStudent.id
      studentName = selectedStudent.name
    }

    try {
      if (!modelsReady || !faceapiRef.current) {
        alert("Face models are not ready yet. Please wait and try again.")
        return
      }

      const context = canvasRef.current.getContext('2d')
      if (!context) return

      context.drawImage(videoRef.current, 0, 0)
      const imageData = canvasRef.current.toDataURL('image/jpeg', 0.9)
      setCapturedImage(imageData)

      console.log('[v0] Captured face for student:', studentId, studentName)
      
      // Generate real embedding using face-api.js
      const faceapi = faceapiRef.current
      const img = await loadImageFromUrl(imageData)
      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection?.descriptor) {
        alert("No face detected. Please try again with a clearer image.")
        return
      }

      const embedding = Array.from(detection.descriptor) as number[]

      // Save to database (source of truth)
      const res = await fetch("/api/students/dataset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          studentName,
          rollNumber: null,
          imageData,
          embedding,
        }),
      })

      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to save student facial data")
      }

      await refreshStudentDatasetFromDb()
      
      // Reset form
      setManualStudentId('')
      setManualStudentName('')
      setSelectedStudent(null)
      stopCamera()
      alert(`Successfully added facial data for ${studentName}`)
    } catch (err) {
      console.error('[v0] Error capturing face:', err)
      alert('Error capturing face')
    }
  }

  // Remove student from dataset
  const removeFromDataset = (studentId: string) => {
    const remove = async () => {
      try {
        const res = await fetch("/api/students/dataset/delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ studentId }),
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to delete student facial data")
        await refreshStudentDatasetFromDb()
      } catch (e) {
        console.error('[v0] Failed to delete student facial data:', e)
        alert("Failed to delete student facial data")
      }
    }

    void remove()
  }

  const getStudentBiometric = (studentId: string) => {
    return studentDataset.find((s) => s.studentId === studentId)
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Facial Recognition Setup</h3>
        <p className="text-sm text-foreground/60 mb-6">
          Capture student facial data for automatic attendance marking. Each student needs one clear face image.
        </p>

        {/* Input Method Selection */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={useManualEntry ? 'outline' : 'default'}
            onClick={() => {
              setUseManualEntry(false)
              setManualStudentId('')
              setManualStudentName('')
              stopCamera()
            }}
          >
            Select from List
          </Button>
          <Button
            variant={useManualEntry ? 'default' : 'outline'}
            onClick={() => {
              setUseManualEntry(true)
              setSelectedStudent(null)
              stopCamera()
            }}
          >
            Manual Entry
          </Button>
        </div>

        {/* Student Selection or Manual Entry */}
        <div className="space-y-4 mb-6">
          {!useManualEntry ? (
            <div>
              <label className="text-sm font-medium text-foreground">Select Student</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                {students.map((student) => {
                  const hasBiometric = getStudentBiometric(student.id)
                  return (
                    <Button
                      key={student.id}
                      variant={selectedStudent?.id === student.id ? 'default' : 'outline'}
                      className="text-left"
                      onClick={() => {
                        stopCamera()
                        setSelectedStudent(student)
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span>{student.name}</span>
                        {hasBiometric && <CheckCircle className="w-4 h-4 text-green-500" />}
                      </div>
                    </Button>
                  )
                })}
              </div>

              {selectedStudent && (
                <div className="p-4 bg-primary/10 rounded border border-primary/20 mt-4">
                  <p className="text-sm">
                    <span className="font-semibold">Selected:</span> {selectedStudent.name} (ID: {selectedStudent.id})
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Student ID</label>
                <Input
                  placeholder="e.g., STU-001"
                  value={manualStudentId}
                  onChange={(e) => setManualStudentId(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Student Name</label>
                <Input
                  placeholder="e.g., John Doe"
                  value={manualStudentName}
                  onChange={(e) => setManualStudentName(e.target.value)}
                  className="mt-2"
                />
              </div>
              {manualStudentId && manualStudentName && (
                <div className="p-4 bg-primary/10 rounded border border-primary/20">
                  <p className="text-sm">
                    <span className="font-semibold">Entry:</span> {manualStudentName} (ID: {manualStudentId})
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Camera Section */}
        {(selectedStudent || (useManualEntry && manualStudentId && manualStudentName)) && (
          <div className="space-y-4 mb-6">
            <div className="space-y-3">
              {!cameraActive ? (
                <Button onClick={startCamera} className="w-full gap-2">
                  <Camera className="w-4 h-4" />
                  Start Camera
                </Button>
              ) : (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <canvas ref={canvasRef} className="hidden" width={1280} height={720} />

                  {capturedImage && (
                    <div className="p-3 bg-green-50 rounded border border-green-200 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-700">Face captured successfully</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={captureFace} className="flex-1" disabled={!!capturedImage}>
                      {capturedImage ? 'Saved ✓' : 'Capture Face'}
                    </Button>
                    <Button onClick={stopCamera} variant="outline" className="flex-1">
                      Close
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Biometric Dataset Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Biometric Dataset</h3>
        <p className="text-sm text-foreground/60 mb-4">
          {studentDataset.length} of {students.length} students have facial data
        </p>

        <div className="space-y-2">
          {studentDataset.length === 0 ? (
            <p className="text-foreground/60 text-center py-4">No facial data captured yet</p>
          ) : (
            <div className="space-y-2">
              {studentDataset.map((biometric) => {
                const student = students.find((s) => s.id === biometric.studentId)
                return (
                  <div key={biometric.studentId} className="flex items-center justify-between p-3 bg-background rounded border">
                    <div className="flex items-center gap-3">
                      {biometric.faceImage && (
                        <img
                          src={biometric.faceImage}
                          alt={biometric.studentName}
                          className="w-10 h-10 rounded object-cover"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{biometric.studentName}</p>
                        <p className="text-xs text-foreground/60">
                          ID: {biometric.studentId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800">Ready</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFromDataset(biometric.studentId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
