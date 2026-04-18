"use client"

import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Camera, AlertCircle, CheckCircle } from "lucide-react"
import { loadFaceApiModelWeights, loadImageFromUrl } from "@/lib/face-api-models"

interface StudentData {
  studentId: string
  studentName: string
  embedding?: number[]
}

interface DetectedStudent {
  id: string
  name: string
  confidence: number
  timestamp: Date
}

interface FaceRecognitionCameraProps {
  onAttendanceMarked?: (student: DetectedStudent) => void
  isActive: boolean
  classStartTime: Date
  autoMarkAfterMinutes?: number
  /** Overrides the confidence threshold used to auto-mark present. */
  confidenceThreshold?: number
  /** Overrides scan interval (ms). */
  detectionIntervalMs?: number
  classId: string
  /** If set, only these students can be matched and auto-marked (e.g. class roster). */
  enrolledStudentIds?: string[]
  /** Hide the in-card countdown when the parent session already shows a timer. */
  showEmbeddedTimer?: boolean
}

function mapBoxToDisplay(
  box: { x: number; y: number; width: number; height: number },
  videoW: number,
  videoH: number,
  clientW: number,
  clientH: number,
): { x: number; y: number; width: number; height: number } {
  if (!videoW || !videoH || !clientW || !clientH) return { x: 0, y: 0, width: 0, height: 0 }
  const scale = Math.max(clientW / videoW, clientH / videoH)
  const dispW = videoW * scale
  const dispH = videoH * scale
  const offX = (clientW - dispW) / 2
  const offY = (clientH - dispH) / 2
  return {
    x: box.x * scale + offX,
    y: box.y * scale + offY,
    width: box.width * scale,
    height: box.height * scale,
  }
}

function euclideanDistance(a: number[], b: number[]) {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

export function FaceRecognitionCamera({
  onAttendanceMarked,
  isActive,
  classStartTime: _classStartTime,
  autoMarkAfterMinutes = 10,
  confidenceThreshold,
  detectionIntervalMs,
  classId,
  enrolledStudentIds,
  showEmbeddedTimer = true,
}: FaceRecognitionCameraProps) {
  void _classStartTime
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(autoMarkAfterMinutes * 60)
  const [studentDataset, setStudentDataset] = useState<StudentData[]>([])
  const [modelsReady, setModelsReady] = useState(false)
  const [lastDetectionsCount, setLastDetectionsCount] = useState<number | null>(null)
  const [lastTickAt, setLastTickAt] = useState<string>("")
  const [videoReady, setVideoReady] = useState(false)
  const [videoDims, setVideoDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const faceapiRef = useRef<null | typeof import("@vladmandic/face-api")>(null)
  const debugTickRef = useRef(0)

  // Reset session-scoped UI state when a new session starts (class or active flag changes).
  useEffect(() => {
    if (!isActive) return
    setDetectedStudents([])
    setLastDetectionsCount(null)
    setLastTickAt("")
    setTimeRemaining(autoMarkAfterMinutes * 60)
    setVideoReady(false)
    setVideoDims({ w: 0, h: 0 })
  }, [classId, isActive, autoMarkAfterMinutes])

  // Face descriptors from face-api are compared by Euclidean distance (lower is better).
  // Tuned a bit looser so genuine students are not rejected as unknown.
  const FACE_DISTANCE_THRESHOLD = 0.62
  // Ambiguity guard: if top-2 matches are too close, treat as unknown.
  const FACE_AMBIGUITY_MARGIN = 0.02
  // Keep prop for backward compatibility (not used for match gating now).
  void confidenceThreshold
  const SCAN_INTERVAL_MS = typeof detectionIntervalMs === "number" ? detectionIntervalMs : 1800

  const rosterKey = useMemo(() => {
    if (enrolledStudentIds === undefined) return "__all__"
    if (enrolledStudentIds.length === 0) return "__empty__"
    return [...enrolledStudentIds].map(String).sort().join("\0")
  }, [enrolledStudentIds])

  // Load student dataset from DB (source of truth)
  useEffect(() => {
    const load = async () => {
      try {
        if (enrolledStudentIds !== undefined && enrolledStudentIds.length === 0) {
          setStudentDataset([])
          return
        }
        const res = await fetch("/api/students/dataset")
        const json = (await res.json()) as { ok: boolean; data?: StudentData[] }
        if (res.ok && json.ok && Array.isArray(json.data)) {
          let rows = json.data as StudentData[]
          if (enrolledStudentIds !== undefined && enrolledStudentIds.length > 0) {
            const allow = new Set(enrolledStudentIds.map((id) => String(id)))
            rows = rows.filter((s) => allow.has(String(s.studentId)))
          }
          setStudentDataset(rows)
          return
        }
      } catch {
        // ignore
      }
    }

    load()
  }, [rosterKey, enrolledStudentIds])

  // Load face-api models once
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const faceapi = await import("@vladmandic/face-api")
        faceapiRef.current = faceapi
        await loadFaceApiModelWeights(faceapi)
        if (!cancelled) {
          setModelsReady(true)
          setError(null)
        }
      } catch (e) {
        console.error("[v0] Failed to load face models:", e)
        if (!cancelled) {
          setModelsReady(false)
          setError(
            e instanceof Error
              ? e.message
              : "Face recognition models could not be loaded. Check your network or add weights under /public/models.",
          )
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Initialize camera
  useEffect(() => {
    if (!isActive) return

    const initCamera = async () => {
      try {
        setCameraActive(false)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (videoRef.current) {
          // Muted + play() after metadata is the most reliable way to ensure
          // videoWidth/videoHeight become available across refresh/back navigation.
          videoRef.current.muted = true
          videoRef.current.srcObject = stream
          // Ensure the element actually starts playing (some browsers keep videoWidth=0 until play()).
          await videoRef.current.play().catch(() => {})
          setError(null)
        }
      } catch (err) {
        setError("Unable to access camera. Please check permissions.")
        setCameraActive(false)
      }
    }

    initCamera()

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
      if (videoRef.current) videoRef.current.srcObject = null
      setCameraActive(false)
      setVideoReady(false)
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isActive])



  const tryMarkStudent = useCallback((newStudent: DetectedStudent) => {
    const today = new Date().toISOString().split("T")[0]
    const alreadyRecorded =
      localStorage.getItem(`attendanceMarked:${classId}:${today}:${newStudent.id}`) === "1"
    // Even if this student was already marked earlier today (e.g. session restarted),
    // we still need to notify the parent so the in-session roster + summary reflect "present".
    if (alreadyRecorded) {
      onAttendanceMarked?.(newStudent)
      return
    }

    const payload = {
      studentId: newStudent.id,
      classId,
      date: today,
      status: "present",
      method: "face_recognition",
      markedAt: newStudent.timestamp.toISOString(),
      confidence: newStudent.confidence,
    }

    const persistMarkWithRetry = async () => {
      const maxAttempts = 3
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await fetch("/api/attendance/mark", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
          const json = await res.json().catch(() => ({}))
          if (res.ok && json?.ok) return
          throw new Error(json?.error || `Attendance save failed (attempt ${attempt})`)
        } catch (error) {
          if (attempt === maxAttempts) {
            console.error("[v0] Failed to persist face attendance mark:", error)
            return
          }
          await new Promise((resolve) => setTimeout(resolve, 350 * attempt))
        }
      }
    }
    void persistMarkWithRetry()

    try {
      const existingRecords = JSON.parse(localStorage.getItem("attendanceRecords") || "[]") as any[]
      const filtered = existingRecords.filter(
        (r) => !(r.date === today && r.classId === classId && r.studentId === newStudent.id),
      )
      filtered.push({
        studentId: newStudent.id,
        studentName: newStudent.name,
        classId,
        date: today,
        status: "present",
        method: "face_recognition",
        markedAt: newStudent.timestamp.toISOString(),
        timestamp: newStudent.timestamp.toISOString(),
        time: newStudent.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        confidence: newStudent.confidence,
      })
      localStorage.setItem("attendanceRecords", JSON.stringify(filtered))
    } catch {
      // ignore
    }

    localStorage.setItem(`attendanceMarked:${classId}:${today}:${newStudent.id}`, "1")
    onAttendanceMarked?.(newStudent)
  }, [classId, onAttendanceMarked])

  // Auto-start face detection when camera is active — multi-face + overlay boxes
  useEffect(() => {
    if (!cameraActive || !videoReady || !isActive || timeRemaining <= 0 || !modelsReady) return

    const tick = async () => {
      // Prove the loop is running even if we early-return later.
      setLastTickAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }))

      if (!videoRef.current || !canvasRef.current) return
      if (studentDataset.length === 0) return
      if (!studentDataset.some((s) => Array.isArray(s.embedding) && s.embedding.length > 0)) return

      setIsProcessing(true)
      try {
        const video = videoRef.current
        const capture = canvasRef.current
        if (!video.videoWidth || !video.videoHeight) return
        if (capture.width === 0 || capture.height === 0) {
          capture.width = video.videoWidth
          capture.height = video.videoHeight
        }
        const context = capture.getContext("2d")
        if (!context) return

        context.drawImage(video, 0, 0, capture.width, capture.height)
        const imageData = capture.toDataURL("image/jpeg", 0.85)

        const faceapi = faceapiRef.current
        if (!faceapi) return

        const img = await loadImageFromUrl(imageData)
        const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors()
        setLastDetectionsCount(detections.length)

        const overlay = overlayRef.current
        const container = containerRef.current
        if (overlay && container && video.videoWidth && video.videoHeight) {
          const cw = container.clientWidth
          const ch = container.clientHeight
          overlay.width = cw
          overlay.height = ch
          const octx = overlay.getContext("2d")
          if (octx) {
            octx.clearRect(0, 0, cw, ch)
            octx.lineWidth = 3
            octx.font = "bold 14px system-ui, sans-serif"

            for (const det of detections) {
              const desc = det.descriptor ? Array.from(det.descriptor) : null
              if (!desc) continue

              const candidates: Array<{ studentId: string; studentName: string; distance: number; confidence: number }> = []
              for (const s of studentDataset) {
                if (!s.embedding || s.embedding.length !== desc.length) continue
                const distance = euclideanDistance(desc, s.embedding)
                const confidence = Math.max(0, Math.min(1, 1 - distance / FACE_DISTANCE_THRESHOLD))
                candidates.push({ studentId: s.studentId, studentName: s.studentName, distance, confidence })
              }
              candidates.sort((a, b) => a.distance - b.distance)
              const best = candidates[0] ?? null
              const second = candidates[1] ?? null
              const withinDistance = Boolean(best && best.distance <= FACE_DISTANCE_THRESHOLD)
              const clearlyBest = !second || second.distance - (best?.distance ?? 0) >= FACE_AMBIGUITY_MARGIN
              const matched = Boolean(best && withinDistance && clearlyBest)

              const box = det.detection.box
              const mapped = mapBoxToDisplay(box, video.videoWidth, video.videoHeight, cw, ch)
              octx.strokeStyle = matched ? "#22c55e" : "#ef4444"
              octx.fillStyle = matched ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)"
              octx.fillRect(mapped.x, mapped.y, mapped.width, mapped.height)
              octx.strokeRect(mapped.x, mapped.y, mapped.width, mapped.height)

              const label = matched && best ? `${best.studentName} (${Math.round(best.confidence * 100)}%)` : "Unknown"
              const tw = octx.measureText(label).width
              octx.fillStyle = matched ? "#166534" : "#991b1b"
              octx.fillRect(mapped.x, Math.max(0, mapped.y - 22), tw + 12, 22)
              octx.fillStyle = "#fff"
              octx.fillText(label, mapped.x + 6, Math.max(14, mapped.y - 6))
            }
          }
        }

        const additions: DetectedStudent[] = []
        const seenThisFrame = new Set<string>()
        for (const det of detections) {
          if (!det.descriptor) continue
          const detected = Array.from(det.descriptor)

          const candidates: Array<{ studentId: string; studentName: string; distance: number; confidence: number }> = []
          for (const s of studentDataset) {
            if (!s.embedding || s.embedding.length !== detected.length) continue
            const distance = euclideanDistance(detected, s.embedding)
            const confidence = Math.max(0, Math.min(1, 1 - distance / FACE_DISTANCE_THRESHOLD))
            candidates.push({ studentId: s.studentId, studentName: s.studentName, distance, confidence })
          }
          candidates.sort((a, b) => a.distance - b.distance)
          const best = candidates[0] ?? null
          const second = candidates[1] ?? null

          if (!best) continue
          const withinDistance = best.distance <= FACE_DISTANCE_THRESHOLD
          const clearlyBest = !second || second.distance - best.distance >= FACE_AMBIGUITY_MARGIN
          if (!withinDistance || !clearlyBest) continue
          if (seenThisFrame.has(best.studentId)) continue
          seenThisFrame.add(best.studentId)

          debugTickRef.current += 1
          if (debugTickRef.current % 5 === 0) {
            console.log("[v0] Match:", best.studentName, "confidence:", best.confidence)
          }

          additions.push({
            id: best.studentId,
            name: best.studentName,
            confidence: best.confidence,
            timestamp: new Date(),
          })
        }

        if (additions.length > 0) {
          setDetectedStudents((prev) => {
            const prevIds = new Set(prev.map((s) => s.id))
            const fresh = additions.filter((a) => !prevIds.has(a.id))
            if (fresh.length === 0) return prev

            // Defer side-effects so we don't update parent during render.
            queueMicrotask(() => {
              for (const n of fresh) tryMarkStudent(n)
            })

            return [...prev, ...fresh]
          })
        }
      } catch (err) {
        console.error("[v0] Face detection error:", err)
        setLastDetectionsCount(0)
      } finally {
        setIsProcessing(false)
      }
    }

    // Run immediately (so starting a session doesn't wait 1.8s),
    // and also run on an interval.
    void tick()
    const interval = setInterval(tick, SCAN_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [
    cameraActive,
    videoReady,
    isActive,
    timeRemaining,
    studentDataset,
    modelsReady,
    tryMarkStudent,
    SCAN_INTERVAL_MS,
  ])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const isTimeExpired = timeRemaining === 0

  return (
    <Card className="p-6 bg-card">
      <div className="space-y-4">
        {/* Camera Section */}
        <div className="relative">
          <div
            ref={containerRef}
            className="aspect-video bg-black rounded-lg overflow-hidden border-2 border-border relative"
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                if (canvasRef.current && videoRef.current) {
                  canvasRef.current.width = videoRef.current.videoWidth
                  canvasRef.current.height = videoRef.current.videoHeight
                }
                // On some browsers the stream attaches but doesn't start until after metadata.
                videoRef.current?.play().catch(() => {})
              }}
              onPlaying={() => {
                const v = videoRef.current
                if (!v) return
                setVideoDims({ w: v.videoWidth || 0, h: v.videoHeight || 0 })
                setVideoReady(Boolean(v.videoWidth && v.videoHeight))
                setCameraActive(true)
              }}
            />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              aria-hidden
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay Elements */}
            <div className="absolute top-4 left-4 z-20">
              {cameraActive ? (
                <Badge className="bg-primary text-primary-foreground flex gap-2">
                  <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                  LIVE
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/20 text-destructive">
                  Camera Inactive
                </Badge>
              )}
            </div>

            {/* Timer (optional when parent shows session timer) */}
            {showEmbeddedTimer ? (
              <div className="absolute top-4 right-4 z-20">
                <div
                  className={`px-4 py-2 rounded-lg font-mono font-bold text-lg ${
                    isTimeExpired
                      ? "bg-destructive/20 text-destructive"
                      : timeRemaining < 60
                        ? "bg-accent/20 text-accent"
                        : "bg-primary/20 text-primary"
                  }`}
                >
                  {formatTime(timeRemaining)}
                </div>
              </div>
            ) : null}

            {/* Center Detection Indicator */}
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="w-24 h-24 border-4 border-primary rounded-full animate-pulse" />
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                  <p className="text-white text-sm">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status & Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              {cameraActive ? (
                <CheckCircle className="w-4 h-4 text-primary" />
              ) : (
                <AlertCircle className="w-4 h-4 text-accent" />
              )}
              <p className="font-semibold text-foreground">Camera Status</p>
            </div>
            <p className="text-sm text-foreground/60">
              {cameraActive ? "Camera is active and scanning" : "Waiting for camera access"}
            </p>
            <p className="text-xs text-foreground/50 mt-2">
              Models: {modelsReady ? "ready" : "loading"} • Video:{" "}
              {videoReady ? `${videoDims.w}x${videoDims.h}` : "starting"} • Dataset: {studentDataset.length} • Last detect:{" "}
              {lastDetectionsCount == null ? "—" : `${lastDetectionsCount} face(s)`} {lastTickAt ? `@ ${lastTickAt}` : ""}
            </p>
          </div>

          <div className="bg-card/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-primary" />
              <p className="font-semibold text-foreground">Detected Students</p>
            </div>
            <p className="text-sm text-foreground/60">{detectedStudents.length} students marked present</p>
            {modelsReady && studentDataset.length === 0 && (
              <p className="text-xs text-destructive/80 mt-2">
                No student facial templates found in the database. Ask the teacher to add faces in Student Dataset.
              </p>
            )}
          </div>
        </div>

        {/* Detected Students Grid */}
        {detectedStudents.length > 0 && (
          <div className="border-t border-border pt-4">
            <h4 className="font-semibold text-foreground mb-3">Marked Present</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {detectedStudents.map((student) => (
                <div key={student.id} className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="font-medium text-foreground text-sm truncate">{student.name}</p>
                  <p className="text-xs text-foreground/60">{student.id}</p>
                  <Badge variant="outline" className="text-xs mt-2">
                    {Math.round(student.confidence * 100)}% match
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Time Expired Warning */}
        {isTimeExpired && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Attendance window closed</p>
              <p className="text-sm text-destructive/80">
                The 10-minute attendance period has ended. Manual attendance marking may still be available.
              </p>
            </div>
          </div>
        )}

        {/* Status */}
        {cameraActive && !isTimeExpired && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
            <p className="text-sm text-foreground/80">
              <span className="font-semibold">Live facial attendance</span> — boxes show each face; green means a
              roster student was recognized and marked present automatically (≥70% match).
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
