'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { AlertCircle, Camera, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Detection {
  class: string
  confidence: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
  bbox: { x: number; y: number; width: number; height: number }
}

interface Alert {
  id: string
  class: string
  severity: string
  timestamp: string
  cameraId: string
}

type BehaviorDetectionMonitorProps = {
  cameraId?: string
  /** Shown in the card header (e.g. “Classroom monitoring”). */
  sceneTitle?: string
  /** Stored on alerts / incidents for Security Overview (e.g. “Classroom”, “Campus”). */
  alertLocationLabel?: string
  /** Short note under the header about Roboflow / Kaggle models. */
  modelHint?: string
  onRunningChange?: (running: boolean) => void
  onSessionStartedAtChange?: (startedAt: number | null) => void
}

export function BehaviorDetectionMonitor({
  cameraId = "cam-01",
  sceneTitle,
  alertLocationLabel = "Campus",
  modelHint = "Powered by a Roboflow-hosted YOLO model. Use Roboflow Universe or import Kaggle-trained weights into Roboflow Deploy; map labels in lib/behavior-class-map.ts if needed.",
  onRunningChange,
  onSessionStartedAtChange,
}: BehaviorDetectionMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [detections, setDetections] = useState<Detection[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [fps, setFps] = useState(0)
  const [mode, setMode] = useState<'unknown' | 'roboflow' | 'disabled' | 'error'>('unknown')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const lastTimeRef = useRef<number>(Date.now())
  const frameCountRef = useRef(0)
  const fpsCountRef = useRef(0)

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return

      const context = canvasRef.current.getContext('2d')
      if (!context) return

      // Draw video frame
      context.drawImage(
        videoRef.current,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      )

      // Get frame data
      const frameData = canvasRef.current.toDataURL('image/jpeg')

      // Send to detection API every 5 frames for performance
      if (frameCountRef.current % 5 === 0) {
        try {
          const response = await fetch('/api/behavior/yolov8-detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              imageBase64: frameData,
              cameraId,
              frameId: `frame-${frameCountRef.current}` 
            }),
          })

          const result = await response.json().catch(() => ({} as any))
          const nextMode =
            result?.mode === 'roboflow'
              ? 'roboflow'
              : result?.mode === 'disabled'
                ? 'disabled'
                : response.ok
                  ? 'unknown'
                  : 'error'

          setMode(nextMode)
          setStatusMessage(String(result?.message || ''))

          if (response.ok && result.detections) {
            setDetections(result.detections)
            
            // Add new alerts
            if (result.alerts && result.alerts.length > 0) {
              const newAlerts = result.alerts.map((alert: Detection, idx: number) => ({
                id: `${Date.now()}-${idx}`,
                class: alert.class,
                severity: alert.severity,
                timestamp: alert.timestamp,
                cameraId,
              }))
              setAlerts((prev) => [
                ...newAlerts,
                ...prev.slice(0, 9), // Keep last 10 alerts
              ])

              // Persist to localStorage so `SecurityDashboard` and `BehaviorAlerts` can read them.
              try {
                const existing = JSON.parse(localStorage.getItem('behaviorAlerts') || '[]')
                const merged = [...existing, ...newAlerts.map((a: Alert) => ({
                  type: a.class,
                  severity: a.severity,
                  timestamp: a.timestamp,
                  cameraId: a.cameraId,
                  location: alertLocationLabel,
                  description: `${a.class} detected`,
                }))]
                // Keep recent 200
                localStorage.setItem('behaviorAlerts', JSON.stringify(merged.slice(-200)))
              } catch {
                // ignore
              }
            }
          } else if (!response.ok) {
            // If disabled/error, keep the camera running but clear overlays.
            setDetections([])
          }
        } catch (error) {
          console.error('[v0] Detection error:', error)
          setMode('error')
          setStatusMessage(error instanceof Error ? error.message : 'Detection request failed')
        }
      }

      // Update FPS
      const now = Date.now()
      if (now - lastTimeRef.current >= 1000) {
        setFps(fpsCountRef.current)
        fpsCountRef.current = 0
        lastTimeRef.current = now
      }

      frameCountRef.current += 1
      fpsCountRef.current += 1
    }, 33) // ~30 FPS

    return () => clearInterval(interval)
  }, [isRunning, cameraId, alertLocationLabel])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      })
      if (videoRef.current) {
        videoRef.current.muted = true
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
        frameCountRef.current = 0
        fpsCountRef.current = 0
        lastTimeRef.current = Date.now()
        setMode('unknown')
        setStatusMessage('')
        setIsRunning(true)
        onRunningChange?.(true)
        onSessionStartedAtChange?.(Date.now())
      }
    } catch (error) {
      console.error('[v0] Camera access error:', error)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
      setIsRunning(false)
      setDetections([])
      setAlerts([])
      setStatusMessage('')
      setMode('unknown')
      frameCountRef.current = 0
      fpsCountRef.current = 0
      onRunningChange?.(false)
      onSessionStartedAtChange?.(null)
    }
  }

  useEffect(() => {
    return () => {
      onRunningChange?.(false)
      onSessionStartedAtChange?.(null)
    }
  }, [onRunningChange, onSessionStartedAtChange])

  const drawDetections = () => {
    if (!canvasRef.current) return

    const context = canvasRef.current.getContext('2d')
    if (!context) return

    const width = canvasRef.current.width
    const height = canvasRef.current.height

    detections.forEach((detection) => {
      const { bbox, confidence, severity } = detection
      const x = (bbox.x / 100) * width
      const y = (bbox.y / 100) * height
      const w = (bbox.width / 100) * width
      const h = (bbox.height / 100) * height

      // Draw bounding box
      const colors = {
        critical: '#8b0000',
        high: '#ff0000',
        medium: '#ffa500',
        low: '#ffff00',
      }
      context.strokeStyle = colors[severity]
      context.lineWidth = 3
      context.strokeRect(x, y, w, h)

      // Draw label
      context.fillStyle = colors[severity]
      context.font = 'bold 12px Arial'
      context.fillText(
        `${detection.class} ${(confidence * 100).toFixed(0)}%`,
        x,
        y - 5
      )
    })
  }

  useEffect(() => {
    drawDetections()
  }, [detections])

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 flex-wrap">
            <Camera className="w-5 h-5" />
            {sceneTitle ? `${sceneTitle} · ${cameraId}` : `Behavior Detection Monitor · ${cameraId}`}
            {mode === 'roboflow' ? (
              <span className="ml-2 px-2 py-1 bg-green-700 text-green-100 text-xs rounded">
                LIVE (ROBOFLOW)
              </span>
            ) : mode === 'disabled' ? (
              <span className="ml-2 px-2 py-1 bg-red-700 text-red-100 text-xs rounded">
                DISABLED
              </span>
            ) : mode === 'error' ? (
              <span className="ml-2 px-2 py-1 bg-red-700 text-red-100 text-xs rounded">
                ERROR
              </span>
            ) : null}
          </h3>
          <div className="flex gap-2">
            {!isRunning ? (
              <Button
                onClick={startCamera}
                className="flex items-center gap-2"
                variant="default"
              >
                <Play className="w-4 h-4" />
                Start Camera
              </Button>
            ) : (
              <Button
                onClick={stopCamera}
                className="flex items-center gap-2"
                variant="destructive"
              >
                <Square className="w-4 h-4" />
                Stop
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              width={640}
              height={480}
            />
            <div className="absolute top-2 left-2 bg-black/70 px-3 py-1 rounded text-xs text-green-400 font-mono">
              FPS: {fps}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-gray-300">
            <div>Detections: {detections.length}</div>
            <div>Alerts: {alerts.length}</div>
            <div>Status: {isRunning ? 'Live' : 'Stopped'}</div>
          </div>
          {modelHint ? (
            <p className="text-xs text-gray-400 leading-relaxed border-t border-white/10 pt-2 mt-2">{modelHint}</p>
          ) : null}
          {statusMessage ? (
            <div className="mt-2 text-xs text-gray-300/90">
              <span className="text-gray-400">Detector:</span> {statusMessage}
            </div>
          ) : null}
        </div>
      </Card>

      {/* Active Detections */}
      {detections.length > 0 && (
        <Card className="p-4 bg-slate-900">
          <h4 className="font-semibold text-white mb-3">Active Detections</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {detections.map((det, idx) => (
              <div
                key={idx}
                className={`p-2 rounded text-xs ${
                  det.severity === 'critical'
                    ? 'bg-red-900/30 border border-red-500'
                    : det.severity === 'high'
                    ? 'bg-orange-900/30 border border-orange-500'
                    : 'bg-yellow-900/30 border border-yellow-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{det.class}</span>
                  <span className="text-right">
                    {(det.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <Card className="p-4 bg-red-900/10 border border-red-500/30">
          <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Recent Alerts
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-2 bg-red-900/20 border border-red-500/50 rounded text-xs text-red-200"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{alert.class}</span>
                  <span className="text-right text-red-300">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
