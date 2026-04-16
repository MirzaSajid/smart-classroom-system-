"use client"

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Camera, CheckCircle, AlertCircle, Smile } from 'lucide-react'
import { loadFaceApiModelWeights, loadImageFromUrl } from '@/lib/face-api-models'

interface ScanResult {
  matched: boolean
  studentId?: string
  studentName?: string
  confidence?: number
  message: string
}

export function StudentFacialScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** MediaStream must attach after <video> mounts (cameraActive true); ref avoids chicken-and-egg with videoRef. */
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [attendanceMarked, setAttendanceMarked] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [studentDataset, setStudentDataset] = useState<any[]>([])
  const [modelsReady, setModelsReady] = useState(false)
  const faceapiRef = useRef<null | typeof import("@vladmandic/face-api")>(null)

  const FACE_DISTANCE_THRESHOLD = 0.62
  const FACE_AMBIGUITY_MARGIN = 0.02

  useEffect(() => {
    // Get current logged-in student
    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser)
        setCurrentUserId(user.studentId)
      } catch (e) {
        console.error('[v0] Failed to load current user:', e)
      }
    }

    // Load student dataset for matching from DB (source of truth)
    const loadDataset = async () => {
      try {
        const res = await fetch("/api/students/dataset")
        const json = (await res.json()) as { ok: boolean; data?: any[] }
        if (res.ok && json.ok && Array.isArray(json.data)) {
          setStudentDataset(json.data)
        }
      } catch {
        // ignore
      }
    }
    loadDataset()
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

  useEffect(() => {
    return () => {
      const stream = streamRef.current
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Attach stream to <video> only after it exists in the DOM (cameraActive === true).
  useEffect(() => {
    if (!cameraActive) return

    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return

    video.muted = true
    video.playsInline = true
    video.srcObject = stream

    const tryPlay = () => {
      void video.play().catch(() => {})
    }

    video.onloadedmetadata = () => {
      tryPlay()
    }
    tryPlay()

    return () => {
      video.onloadedmetadata = null
    }
  }, [cameraActive])

  const startCamera = async () => {
    setScanResult(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanResult({
        matched: false,
        message: "Camera is not available in this browser (use HTTPS or localhost, and a modern browser).",
      })
      return
    }

    setCameraStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setAttendanceMarked(false)
      setCameraActive(true)
    } catch (err) {
      console.error("[v0] Camera error:", err)
      streamRef.current = null
      setScanResult({
        matched: false,
        message:
          "Unable to access the camera. Allow permission in the browser address bar, close other apps using the camera, and try again.",
      })
    } finally {
      setCameraStarting(false)
    }
  }

  const stopCamera = () => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
    setCameraActive(false)
    setScanning(false)
  }

  const euclideanDistance = (embed1: number[], embed2: number[]): number => {
    if (!embed1 || !embed2 || embed1.length !== embed2.length) return Number.POSITIVE_INFINITY
    let sum = 0
    for (let i = 0; i < embed1.length; i++) {
      const d = embed1[i] - embed2[i]
      sum += d * d
    }
    return Math.sqrt(sum)
  }

  const scanFace = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return

    if (!modelsReady || !faceapiRef.current) {
      setScanResult({
        matched: false,
        message: "Face models not ready. Please refresh and try again.",
      })
      return
    }

    setScanning(true)
    setScanResult(null)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")
      if (!context || !video) return

      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) {
        setScanResult({
          matched: false,
          message: "Camera is still starting. Wait until you see the live picture, then tap Scan Face again.",
        })
        return
      }

      canvas.width = w
      canvas.height = h
      context.drawImage(video, 0, 0, w, h)
      const capturedImage = canvas.toDataURL("image/jpeg", 0.9)

      console.log('[v0] Scanned face, comparing against', studentDataset.length, 'students in dataset')

      if (studentDataset.length === 0) {
        setScanResult({
          matched: false,
          message:
            "No face templates in the uploaded student dataset yet. An admin must add your photo in Student Dataset Manager (stored in the system database; images may also sync to the Facial Attendance System/images folder for Python tools).",
        })
        setScanning(false)
        return
      }

      const faceapi = faceapiRef.current
      const img = await loadImageFromUrl(capturedImage)
      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection?.descriptor) {
        setScanResult({
          matched: false,
          message: "No face detected. Please try again with a clearer image.",
        })
        return
      }

      const capturedEmbedding = Array.from(detection.descriptor)

      // Find nearest match by strict face distance and reject ambiguous faces.
      const candidates: Array<{ student: any; distance: number; confidence: number }> = []
      for (const student of studentDataset) {
        if (!student.embedding) continue
        const distance = euclideanDistance(capturedEmbedding, student.embedding)
        const confidence = Math.max(0, Math.min(1, 1 - distance / FACE_DISTANCE_THRESHOLD))
        candidates.push({ student, distance, confidence })
      }
      candidates.sort((a, b) => a.distance - b.distance)
      const best = candidates[0]
      const second = candidates[1]

      console.log('[v0] Match:', best?.student?.studentName, 'Distance:', best?.distance, 'Confidence:', best?.confidence)

      const withinDistance = !!best && best.distance <= FACE_DISTANCE_THRESHOLD
      const clearlyBest = !second || (second.distance - (best?.distance ?? 0)) >= FACE_AMBIGUITY_MARGIN
      const isMatch = Boolean(best && withinDistance && clearlyBest)

      if (isMatch && best) {
        if (String(best.student.studentId) !== String(currentUserId)) {
          setScanResult({
            matched: false,
            confidence: Math.round(best.confidence * 100),
            message: `This face matches the dataset record for ${best.student.studentName}, not your logged-in account. Check-in only works when your face matches your own uploaded dataset entry.`,
          })
          return
        }
        const result: ScanResult = {
          matched: true,
          studentId: best.student.studentId,
          studentName: best.student.studentName,
          confidence: Math.round(best.confidence * 100),
          message: `Face recognized! Welcome ${best.student.studentName}`,
        }
        setScanResult(result)
        markAttendanceFromScan(best.student.studentId, best.student.studentName, best.confidence)
      } else {
        const result: ScanResult = {
          matched: false,
          confidence: best ? Math.round(best.confidence * 100) : 0,
          message:
            "Unknown face. Your face does not confidently match the uploaded dataset. Please re-capture your dataset image with a clear, front-facing photo.",
        }
        setScanResult(result)
      }
    } catch (err) {
      console.error('[v0] Error scanning face:', err)
      setScanResult({
        matched: false,
        message: 'Error scanning face. Please try again.',
      })
    } finally {
      setScanning(false)
    }
  }

  const markAttendanceFromScan = async (studentId: string, studentName: string, confidence: number) => {
    try {
      // Get current student's enrolled classes
      const adminData = localStorage.getItem('adminData')
      if (!adminData) return

      const data = JSON.parse(adminData)
      const student = data.students?.find((s: any) => s.id === currentUserId)
      if (!student) return

      const enrolledClassIds = student.classIds || []
      if (enrolledClassIds.length === 0) return

      // Mark attendance for all enrolled classes for today
      const today = new Date().toISOString().split('T')[0]
      const existingRecords = JSON.parse(localStorage.getItem('attendanceRecords') || '[]')

      // Only add attendance if not already marked today
      const enrolledClassIds_set = new Set(enrolledClassIds)
      const alreadyMarked = new Set(
        existingRecords
          .filter((r: any) => r.studentId === currentUserId && r.date === today && r.classId)
          .map((r: any) => r.classId)
      )

      const newRecords = []
      for (const classId of enrolledClassIds) {
        if (!alreadyMarked.has(classId)) {
          newRecords.push({
            studentId: currentUserId,
            classId: classId,
            date: today,
            status: 'present',
            method: 'face_recognition',
            markedAt: new Date().toISOString(),
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            confidence: confidence,
            studentName: studentName,
          })
        }
      }

      if (newRecords.length > 0) {
        // Persist to DB (source of truth)
        await Promise.all(
          newRecords.map((r) =>
            fetch("/api/attendance/mark", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                studentId: r.studentId,
                classId: r.classId,
                date: r.date,
                status: "present",
                method: "face_recognition",
                markedAt: r.markedAt,
                confidence: r.confidence,
              }),
            }).catch(() => null),
          ),
        )

        // Keep localStorage in sync for portals/UI
        const updatedRecords = [...existingRecords, ...newRecords]
        localStorage.setItem('attendanceRecords', JSON.stringify(updatedRecords))
        setAttendanceMarked(true)
        console.log('[v0] Marked attendance for', newRecords.length, 'classes via facial recognition')
      } else {
        console.log('[v0] Attendance already marked for today')
      }
    } catch (err) {
      console.error('[v0] Error marking attendance:', err)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-4">
          <Smile className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">Facial Recognition Check-in</h3>
        </div>

        {!cameraActive ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground/80">
              <span className="font-medium text-foreground">How it works:</span> Start camera → live preview appears →
              tap <span className="font-medium">Scan Face</span> → you will see whether you match your record in the
              database and attendance can be marked if you are recognized.
            </p>
            {scanResult && !cameraActive ? (
              <Card className="p-4 border-destructive/30 bg-destructive/5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{scanResult.message}</p>
                </div>
              </Card>
            ) : null}
            <Button
              type="button"
              onClick={() => void startCamera()}
              className="w-full gap-2"
              size="lg"
              disabled={cameraStarting}
            >
              <Camera className="w-5 h-5" />
              {cameraStarting ? "Starting camera…" : "Start Camera"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Live Camera Preview */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {scanning && (
                <div className="absolute inset-0 bg-blue-500/20 animate-pulse flex items-center justify-center">
                  <p className="text-white font-semibold">Scanning...</p>
                </div>
              )}
            </div>

            {/* Hidden canvas for image capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Scan Result */}
            {scanResult && (
              <Card className={`p-4 border-2 ${scanResult.matched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start gap-3">
                  {scanResult.matched ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`font-semibold ${scanResult.matched ? 'text-green-900' : 'text-red-900'}`}>
                      {scanResult.message}
                    </p>
                    {scanResult.confidence !== undefined && (
                      <p className={`text-sm mt-2 ${scanResult.matched ? 'text-green-700' : 'text-red-700'}`}>
                        Confidence: {scanResult.confidence}%
                      </p>
                    )}
                    {attendanceMarked && scanResult.matched && (
                      <Badge className="mt-3 bg-green-600 text-white">
                        ✓ Attendance Marked for All Classes
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Control Buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => void scanFace()}
                disabled={scanning || !modelsReady}
                className="flex-1"
                size="lg"
                variant="default"
              >
                {scanning ? "Scanning…" : !modelsReady ? "Loading face models…" : "Scan Face"}
              </Button>
              <Button type="button" onClick={stopCamera} variant="outline" size="lg">
                Close Camera
              </Button>
            </div>

            <p className="text-xs text-foreground/60 text-center">
              Position your face clearly in the camera for best results
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
