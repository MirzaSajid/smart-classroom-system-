"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Camera, ShieldAlert } from "lucide-react"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

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

    setIsAnalyzing(true)
    try {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = canvas.toDataURL("image/jpeg", 0.8)

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

      const priorHadVape = hadVapeOnPriorScanRef.current
      hadVapeOnPriorScanRef.current = Boolean(json.hasVape)
      const newVapeEvent = Boolean(json.hasVape) && !priorHadVape

      if (json.hasVape && newVapeEvent) {
        const msg = `Vape detected (${json.vapeDetections ?? 1} object(s))`
        setAlerts((prev) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, time: now, message: msg }, ...prev].slice(0, 200))
        try {
          const ts = new Date().toISOString()
          const incident = {
            id: `vape-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            type: "Vape Detection",
            location: "Vape monitor",
            severity: "high",
            time: now,
            details: msg,
            status: "Active",
            timestamp: ts,
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
      setIsAnalyzing(false)
    }
  }

  useEffect(() => {
    if (!isCameraOn) return
    void runSingleScan()
    const timer = setInterval(() => {
      void runSingleScan()
    }, 2500)
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

