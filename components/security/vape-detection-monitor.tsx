"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Camera, ShieldAlert } from "lucide-react"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { loadFaceApiModelWeights, loadImageFromUrl } from "@/lib/face-api-models"

type VapeDetection = {
  label: string
  confidence: number
  bbox: { x1: number; y1: number; x2: number; y2: number }
}

type VapeResult = {
  ok: boolean
  hasVape?: boolean
  vapeDetections?: number
  totalDetections?: number
  detections?: VapeDetection[]
  error?: string
}

type StudentData = {
  studentId: string
  studentName: string
  embedding?: number[]
}

type MatchedStudent = {
  studentId: string
  studentName: string
  confidence: number
}

type HolderOverlay = {
  left: number
  top: number
  width: number
  height: number
  studentId: string
  studentName: string
  confidence: number
}

type FeeInvoice = {
  id: string
  studentId: string
  studentName: string
  title: string
  totalAmount: number
  dueDate: string
  status: "unpaid" | "partial" | "paid"
  createdAt: string
  amountPaid: number
  balance: number
  payments: Array<{ id: string; amount: number; paidAt: string; method: "cash" | "card" | "online"; note?: string }>
  paymentSubmissions: Array<{
    id: string
    amount: number
    submittedAt: string
    slipName: string
    slipDataUrl: string
    status: "pending" | "approved" | "rejected"
    verifiedAt?: string
  }>
  category?: "tuition" | "disciplinary"
  sourceIncidentId?: string
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

function bboxToOverlayRect(
  bbox: VapeDetection["bbox"],
  frameW: number,
  frameH: number,
  boxW: number,
  boxH: number,
) {
  if (!frameW || !frameH || !boxW || !boxH) return null
  const frameAR = frameW / frameH
  const viewAR = boxW / boxH
  let scale: number
  let offsetX = 0
  let offsetY = 0
  if (frameAR > viewAR) {
    scale = boxH / frameH
    offsetX = (boxW - frameW * scale) / 2
  } else {
    scale = boxW / frameW
    offsetY = (boxH - frameH * scale) / 2
  }
  return {
    left: bbox.x1 * scale + offsetX,
    top: bbox.y1 * scale + offsetY,
    width: (bbox.x2 - bbox.x1) * scale,
    height: (bbox.y2 - bbox.y1) * scale,
  }
}

export function VapeDetectionMonitor() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  /** Previous scan already saw a vape — avoids spamming incidents while the same hit stays visible. */
  const hadVapeOnPriorScanRef = useRef(false)

  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<VapeResult | null>(null)
  const [error, setError] = useState("")
  const [lastScanAt, setLastScanAt] = useState<string>("")
  const [alerts, setAlerts] = useState<Array<{ id: string; time: string; message: string }>>([])
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [studentDataset, setStudentDataset] = useState<StudentData[]>([])
  const [faceModelsReady, setFaceModelsReady] = useState(false)
  const [holderOverlay, setHolderOverlay] = useState<HolderOverlay | null>(null)
  const faceapiRef = useRef<null | typeof import("@vladmandic/face-api")>(null)
  const scanInFlightRef = useRef(false)
  const holderCandidateRef = useRef<{ studentId: string; streak: number } | null>(null)
  const stableHolderRef = useRef<MatchedStudent | null>(null)

  const FACE_DISTANCE_THRESHOLD = 0.62
  const FACE_AMBIGUITY_MARGIN = 0.02
  const HOLDER_LOCK_FRAMES = 2
  const VAPE_FINE_AMOUNT = 2000

  const vapeOverlayBoxes = useMemo(() => {
    const video = videoRef.current
    const container = previewRef.current
    const list = result?.detections?.filter((d) => String(d.label).toLowerCase() === "vape") ?? []
    if (!isCameraOn || !video || !container || list.length === 0) return []

    const fw = video.videoWidth
    const fh = video.videoHeight
    const cw = container.clientWidth
    const ch = container.clientHeight
    if (!fw || !fh || !cw || !ch) return []

    return list
      .map((d, i) => {
        const r = bboxToOverlayRect(d.bbox, fw, fh, cw, ch)
        if (!r || r.width < 2 || r.height < 2) return null
        return { ...r, id: `${i}-${d.confidence}`, confidence: d.confidence }
      })
      .filter(Boolean) as Array<{
      id: string
      left: number
      top: number
      width: number
      height: number
      confidence: number
    }>
  }, [result?.detections, layoutVersion, isCameraOn])

  const statusLabel = useMemo(() => {
    if (!isCameraOn) return "Camera Off"
    if (isAnalyzing) return "Analyzing"
    if (result?.hasVape) return "Vape Detected"
    return "Monitoring"
  }, [isCameraOn, isAnalyzing, result?.hasVape])

  const stopCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setIsCameraOn(false)
    setIsAnalyzing(false)
    hadVapeOnPriorScanRef.current = false
    setResult(null)
    setLastScanAt("")
    setAlerts([])
    setHolderOverlay(null)
    holderCandidateRef.current = null
    stableHolderRef.current = null
  }

  useEffect(() => {
    let cancelled = false

    const loadStudents = async () => {
      try {
        const res = await fetch("/api/students/dataset")
        const json = (await res.json()) as { ok: boolean; data?: StudentData[] }
        if (!cancelled && res.ok && json.ok && Array.isArray(json.data)) {
          setStudentDataset(json.data)
        }
      } catch {
        // ignore dataset loading errors
      }
    }

    const loadModels = async () => {
      try {
        const faceapi = await import("@vladmandic/face-api")
        faceapiRef.current = faceapi
        await loadFaceApiModelWeights(faceapi)
        if (!cancelled) setFaceModelsReady(true)
      } catch {
        if (!cancelled) setFaceModelsReady(false)
      }
    }

    void loadStudents()
    void loadModels()
    return () => {
      cancelled = true
    }
  }, [])

  const identifyVapeHolder = async (imageData: string): Promise<MatchedStudent | null> => {
    if (!faceModelsReady) return null
    const faceapi = faceapiRef.current
    if (!faceapi) return null
    const known = studentDataset.filter((s) => Array.isArray(s.embedding) && s.embedding.length > 0)
    if (known.length === 0) return null

    try {
      const img = await loadImageFromUrl(imageData)
      const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors()
      let bestMatch: MatchedStudent | null = null
      let bestDistance = Number.POSITIVE_INFINITY
      let secondBestDistance = Number.POSITIVE_INFINITY

      for (const det of detections) {
        if (!det.descriptor) continue
        const descriptor = Array.from(det.descriptor)
        for (const s of known) {
          if (!s.embedding || s.embedding.length !== descriptor.length) continue
          const distance = euclideanDistance(descriptor, s.embedding)
          if (distance < bestDistance) {
            secondBestDistance = bestDistance
            bestDistance = distance
            bestMatch = {
              studentId: s.studentId,
              studentName: s.studentName,
              confidence: Math.max(0, Math.min(1, 1 - distance / FACE_DISTANCE_THRESHOLD)),
            }
          } else if (distance < secondBestDistance) {
            secondBestDistance = distance
          }
        }
      }

      if (!bestMatch || bestDistance > FACE_DISTANCE_THRESHOLD) return null
      const ambiguous = secondBestDistance - bestDistance < FACE_AMBIGUITY_MARGIN
      if (ambiguous) return null
      return bestMatch
    } catch {
      return null
    }
  }

  const identifyAndLocateVapeHolder = async (
    imageData: string,
    vapeBoxes: VapeDetection[],
  ): Promise<{ match: MatchedStudent | null; overlay: HolderOverlay | null }> => {
    if (!faceModelsReady) return { match: null, overlay: null }
    const faceapi = faceapiRef.current
    const video = videoRef.current
    const container = previewRef.current
    if (!faceapi || !video || !container) return { match: null, overlay: null }
    const known = studentDataset.filter((s) => Array.isArray(s.embedding) && s.embedding.length > 0)
    if (known.length === 0 || vapeBoxes.length === 0) return { match: null, overlay: null }

    try {
      const img = await loadImageFromUrl(imageData)
      const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors()
      if (detections.length === 0) return { match: null, overlay: null }

      let best: {
        studentId: string
        studentName: string
        confidence: number
        distance: number
        faceBox: { x: number; y: number; width: number; height: number }
        faceCenterX: number
        faceCenterY: number
      } | null = null
      let secondBestDistance = Number.POSITIVE_INFINITY

      for (const det of detections) {
        if (!det.descriptor) continue
        const descriptor = Array.from(det.descriptor)
        const faceBox = det.detection.box
        const faceCenterX = faceBox.x + faceBox.width / 2
        const faceCenterY = faceBox.y + faceBox.height / 2

        let nearestVapeDistance = Number.POSITIVE_INFINITY
        for (const vape of vapeBoxes) {
          const vapeCenterX = (vape.bbox.x1 + vape.bbox.x2) / 2
          const vapeCenterY = (vape.bbox.y1 + vape.bbox.y2) / 2
          const dx = faceCenterX - vapeCenterX
          const dy = faceCenterY - vapeCenterY
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < nearestVapeDistance) nearestVapeDistance = d
        }

        for (const s of known) {
          if (!s.embedding || s.embedding.length !== descriptor.length) continue
          const faceDistance = euclideanDistance(descriptor, s.embedding)
          // Blend face match and spatial closeness to prefer the likely holder.
          const score = faceDistance + nearestVapeDistance * 0.0015
          if (!best || score < best.distance) {
            secondBestDistance = best ? best.distance : secondBestDistance
            best = {
              studentId: s.studentId,
              studentName: s.studentName,
              confidence: Math.max(0, Math.min(1, 1 - faceDistance / FACE_DISTANCE_THRESHOLD)),
              distance: score,
              faceBox,
              faceCenterX,
              faceCenterY,
            }
          } else if (score < secondBestDistance) {
            secondBestDistance = score
          }
        }
      }

      if (!best) return { match: null, overlay: null }
      const faceDistanceOnly = Math.max(0, FACE_DISTANCE_THRESHOLD * (1 - best.confidence))
      if (faceDistanceOnly > FACE_DISTANCE_THRESHOLD) return { match: null, overlay: null }
      if (secondBestDistance - best.distance < FACE_AMBIGUITY_MARGIN) return { match: null, overlay: null }

      const mapped = bboxToOverlayRect(
        {
          x1: best.faceBox.x,
          y1: best.faceBox.y,
          x2: best.faceBox.x + best.faceBox.width,
          y2: best.faceBox.y + best.faceBox.height,
        },
        video.videoWidth,
        video.videoHeight,
        container.clientWidth,
        container.clientHeight,
      )
      if (!mapped) return { match: null, overlay: null }

      return {
        match: {
          studentId: best.studentId,
          studentName: best.studentName,
          confidence: best.confidence,
        },
        overlay: {
          left: mapped.left,
          top: mapped.top,
          width: mapped.width,
          height: mapped.height,
          studentId: best.studentId,
          studentName: best.studentName,
          confidence: best.confidence,
        },
      }
    } catch {
      return { match: null, overlay: null }
    }
  }

  const createVapeFineInvoice = (student: MatchedStudent, incidentIso: string, incidentId: string): string | null => {
    try {
      const raw = localStorage.getItem("feeInvoices")
      const existing = raw ? (JSON.parse(raw) as FeeInvoice[]) : []
      const dueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10)
      const today = new Date().toISOString().slice(0, 10)
      const duplicate = existing.some((inv) => {
        if (String(inv.studentId) !== String(student.studentId)) return false
        if (String(inv.status) === "paid") return false
        const createdDay = String(inv.createdAt || "").slice(0, 10)
        const sameTitle = String(inv.title || "").toLowerCase().includes("vape")
        return createdDay === today && sameTitle
      })
      if (duplicate) return null

      const fineId = `fee-vape-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const fineInvoice: FeeInvoice = {
        id: fineId,
        studentId: student.studentId,
        studentName: student.studentName,
        title: "Vape policy violation challan",
        totalAmount: VAPE_FINE_AMOUNT,
        dueDate,
        status: "unpaid",
        createdAt: incidentIso,
        amountPaid: 0,
        balance: VAPE_FINE_AMOUNT,
        payments: [],
        paymentSubmissions: [],
        category: "disciplinary",
        sourceIncidentId: incidentId,
      }
      localStorage.setItem("feeInvoices", JSON.stringify([fineInvoice, ...existing].slice(0, 2000)))
      return fineId
    } catch {
      // ignore fine creation errors
      return null
    }
  }

  const startCamera = async () => {
    setError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsCameraOn(true)
    } catch (e: any) {
      setError(e?.message ?? "Cannot access camera.")
    }
  }

  const runSingleScan = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !isCameraOn || video.videoWidth === 0 || video.videoHeight === 0) return

    if (scanInFlightRef.current) return
    scanInFlightRef.current = true
    setIsAnalyzing(true)
    try {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = canvas.toDataURL("image/jpeg", 0.9)

      const res = await fetch("/api/security/vape-detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageData, confidence: 0.4 }),
      })
      const json = (await res.json().catch(() => null)) as VapeResult | null
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Vape detection failed")

      setResult(json)
      const now = new Date().toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })
      setLastScanAt(now)

      let matchedHolderFromFrame: MatchedStudent | null = null
      if (!json.hasVape) {
        setHolderOverlay(null)
        holderCandidateRef.current = null
        stableHolderRef.current = null
      } else {
        const vapes = json.detections?.filter((d) => String(d.label).toLowerCase() === "vape") ?? []
        const located = await identifyAndLocateVapeHolder(imageData, vapes)
        if (!located.match || !located.overlay) {
          holderCandidateRef.current = null
          stableHolderRef.current = null
          setHolderOverlay(null)
        } else {
          const current = holderCandidateRef.current
          if (!current || current.studentId !== located.match.studentId) {
            holderCandidateRef.current = { studentId: located.match.studentId, streak: 1 }
          } else {
            holderCandidateRef.current = { studentId: current.studentId, streak: current.streak + 1 }
          }

          const isLocked = (holderCandidateRef.current?.streak ?? 0) >= HOLDER_LOCK_FRAMES
          if (isLocked) {
            stableHolderRef.current = located.match
            setHolderOverlay(located.overlay)
            matchedHolderFromFrame = located.match
          } else {
            setHolderOverlay(null)
            matchedHolderFromFrame = stableHolderRef.current
          }
        }
      }

      const priorHadVape = hadVapeOnPriorScanRef.current
      hadVapeOnPriorScanRef.current = Boolean(json.hasVape)
      const newVapeEvent = Boolean(json.hasVape) && !priorHadVape

      if (json.hasVape && newVapeEvent) {
        const incidentId = `vape-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        const matchedStudent = matchedHolderFromFrame ?? (await identifyVapeHolder(imageData))
        const who = matchedStudent
          ? ` — Student: ${matchedStudent.studentName} (${matchedStudent.studentId})`
          : " — Student: Unknown"
        let fineInvoiceId = ""
        if (matchedStudent) {
          fineInvoiceId = createVapeFineInvoice(matchedStudent, new Date().toISOString(), incidentId) ?? ""
        }
        const challanNote = fineInvoiceId ? ` — Challan: ${fineInvoiceId}` : ""
        const msg = `Vape detected (${json.vapeDetections ?? 1} object(s))${who}${challanNote}`
        setAlerts((prev) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, time: now, message: msg }, ...prev].slice(0, 200))
        try {
          const ts = new Date().toISOString()
          const incident = {
            id: incidentId,
            type: "Vape Detection",
            location: "Vape monitor",
            severity: "high",
            time: now,
            details: msg,
            status: "Active",
            timestamp: ts,
            studentId: matchedStudent?.studentId ?? "",
            studentName: matchedStudent?.studentName ?? "",
            studentConfidence: matchedStudent?.confidence ?? 0,
            fineInvoiceId,
            invoiceCategory: fineInvoiceId ? "disciplinary" : "",
          }
          const existing = JSON.parse(localStorage.getItem("behaviorAlerts") || "[]") as unknown[]
          localStorage.setItem("behaviorAlerts", JSON.stringify([...existing, incident].slice(-200)))
        } catch {
          // ignore storage errors
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to scan frame")
    } finally {
      scanInFlightRef.current = false
      setIsAnalyzing(false)
    }
  }

  useEffect(() => {
    if (!isCameraOn) return
    void runSingleScan()
    const timer = setInterval(() => {
      void runSingleScan()
    }, 1200)
    return () => clearInterval(timer)
  }, [isCameraOn])

  useEffect(() => {
    return () => stopCamera()
  }, [])

  useLayoutEffect(() => {
    const el = previewRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setLayoutVersion((v) => v + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const bump = () => setLayoutVersion((v) => v + 1)
    video.addEventListener("loadedmetadata", bump)
    video.addEventListener("playing", bump)
    return () => {
      video.removeEventListener("loadedmetadata", bump)
      video.removeEventListener("playing", bump)
    }
  }, [isCameraOn])

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            Vape Detection Monitor
          </h3>
        </div>
        <Badge variant={result?.hasVape ? "destructive" : "outline"}>{statusLabel}</Badge>
      </div>

      {error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div ref={previewRef} className="relative rounded-lg overflow-hidden border border-border bg-black/70">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-[320px] object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {vapeOverlayBoxes.map((b) => (
                <div
                  key={b.id}
                  className="absolute rounded-sm border-2 border-red-500 bg-red-500/10 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                  style={{
                    left: b.left,
                    top: b.top,
                    width: b.width,
                    height: b.height,
                  }}
                >
                  <span className="absolute left-0 top-0 rounded-br px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">
                    vape
                  </span>
                </div>
              ))}
              {holderOverlay ? (
                <div
                  className="absolute rounded-sm border-2 border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                  style={{
                    left: holderOverlay.left,
                    top: holderOverlay.top,
                    width: holderOverlay.width,
                    height: holderOverlay.height,
                  }}
                >
                  <span className="absolute left-0 top-0 rounded-br px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-emerald-600 text-white">
                    {holderOverlay.studentName} ({holderOverlay.studentId})
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2">
            {!isCameraOn ? (
              <Button onClick={startCamera} className="gap-2">
                <Camera className="w-4 h-4" />
                Start
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopCamera}>
                Turn off camera
              </Button>
            )}
          </div>
          <p className="text-xs text-foreground/60">{lastScanAt ? `Last scan: ${lastScanAt}` : "No scan yet."}</p>
        </div>

        <div className="space-y-3">
          <Card className="p-3">
            <p className="text-sm text-foreground/70">Detections in last scan</p>
            <p className="text-xl font-semibold">{result?.totalDetections ?? 0}</p>
            <p className="text-sm text-destructive">Vape: {result?.vapeDetections ?? 0}</p>
          </Card>

          <Card className="p-3 max-h-[250px] overflow-y-auto">
            <p className="text-sm font-medium mb-2">Recent Vape Alerts</p>
            {alerts.length === 0 ? (
              <p className="text-sm text-foreground/60">No vape alerts yet.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a) => (
                  <div key={a.id} className="rounded border border-destructive/30 bg-destructive/5 p-2">
                    <p className="text-sm text-destructive font-medium">{a.message}</p>
                    <p className="text-xs text-foreground/60">{a.time}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </Card>
  )
}

