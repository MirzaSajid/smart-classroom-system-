"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, MapPin, Eye, AlertCircle, Video, Building2, Shield } from "lucide-react"
import { useState, useEffect } from "react"
import { BehaviorDetectionMonitor } from "@/components/behavior/behavior-detection-monitor"
import { BehaviorAlerts } from "@/components/behavior/behavior-alerts"
import { BehaviorAnalytics } from "@/components/behavior/behavior-analytics"
import { VapeDetectionMonitor } from "@/components/security/vape-detection-monitor"

type SecurityIncident = {
  id: string
  type: string
  location: string
  severity: string
  time: string
  details: string
  status: string
}

function normalizeSecurityIncident(raw: Record<string, unknown>): SecurityIncident {
  const id = String(raw.id ?? `inc-${raw.timestamp ?? Date.now()}`)
  const time =
    typeof raw.time === "string"
      ? raw.time
      : typeof raw.timestamp === "string"
        ? new Date(raw.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })
        : ""
  return {
    id,
    type: String(raw.type ?? "Security alert"),
    location: String(raw.location ?? "Campus"),
    severity: String(raw.severity ?? "medium"),
    time,
    details: String(raw.details ?? raw.description ?? ""),
    status: String(raw.status ?? "Active"),
  }
}

export function SecurityDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "behavior" | "vape">("behavior")
  const [behaviorScene, setBehaviorScene] = useState<"classroom" | "campus">("campus")
  const [isBehaviorCameraLive, setIsBehaviorCameraLive] = useState(false)
  const [behaviorSessionStartedAt, setBehaviorSessionStartedAt] = useState<number | null>(null)
  const [behaviorAlerts, setBehaviorAlerts] = useState<SecurityIncident[]>([])
  const behaviorCameraId = behaviorScene === "classroom" ? "classroom-cam-01" : "campus-patrol-01"

  // Load behavior + vape incidents from localStorage (updated on detections)
  const loadAlerts = () => {
    const stored = localStorage.getItem("behaviorAlerts")
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, unknown>[]
        const scored = parsed.map((raw) => {
          const t =
            typeof raw.timestamp === "string"
              ? new Date(raw.timestamp).getTime()
              : typeof raw.time === "string"
                ? Date.parse(raw.time)
                : 0
          return { raw, t: Number.isFinite(t) ? t : 0 }
        })
        scored.sort((a, b) => b.t - a.t)
        const normalized = scored.map(({ raw }) => normalizeSecurityIncident(raw))
        setBehaviorAlerts(normalized.slice(0, 50))
      } catch (e) {
        console.error("[v0] Failed to load behavior alerts:", e)
      }
    } else {
      setBehaviorAlerts([])
    }
  }

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 2000)
    return () => clearInterval(interval)
  }, [])

  // All data now comes from real sources - no demo data
  const incidents: SecurityIncident[] = behaviorAlerts
  const cameras: any[] = []

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Security Dashboard</h2>
        <p className="text-foreground/60">Real-time campus security monitoring and incident tracking</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-foreground/60 hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Security Overview
          </div>
        </button>
        <button
          onClick={() => setActiveTab("behavior")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "behavior"
              ? "border-primary text-primary"
              : "border-transparent text-foreground/60 hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4" />
            Behavior Detection
          </div>
        </button>
        <button
          onClick={() => setActiveTab("vape")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "vape"
              ? "border-primary text-primary"
              : "border-transparent text-foreground/60 hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Vape Detection
          </div>
        </button>
      </div>

      {activeTab === "overview" && (
        <>
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Active Incidents</p>
              <p className="text-2xl font-bold text-destructive">{incidents.filter((i) => i.status === "Active").length}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-destructive/40" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Monitoring</p>
              <p className="text-2xl font-bold text-accent">{incidents.filter((i) => i.status === "Monitoring").length}</p>
            </div>
            <Eye className="w-8 h-8 text-accent/40" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Total Incidents</p>
              <p className="text-2xl font-bold text-primary">{incidents.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-primary/40" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Cameras Online</p>
              <p className="text-2xl font-bold text-foreground">{cameras.filter((c) => c.status === "online").length}/{cameras.length}</p>
            </div>
            <MapPin className="w-8 h-8 text-foreground/40" />
          </div>
        </Card>
      </div>

      {/* Incidents */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Active Incidents</h3>
        <div className="space-y-4">
          {incidents.map((incident) => (
            <div
              key={incident.id}
              className={`p-4 rounded-lg border ${
                incident.severity === "high" ? "bg-destructive/5 border-destructive/30" : "bg-accent/5 border-accent/30"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-foreground">{incident.type}</p>
                  <p className="text-sm text-foreground/60 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {incident.location}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      incident.severity === "high" ? "bg-destructive/20 text-destructive" : "bg-accent/20 text-accent"
                    }`}
                  >
                    {String(incident.severity).toUpperCase()}
                  </span>
                  <p className="text-xs text-foreground/50 mt-1">{incident.time}</p>
                </div>
              </div>
              <p className="text-sm text-foreground/70">{incident.details}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="inline-block w-2 h-2 rounded-full bg-accent"></span>
                <p className="text-xs text-foreground/60">{incident.status}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Camera Feed Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Camera Feed Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((camera) => (
            <div key={camera.id} className="p-4 rounded-lg bg-card/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-foreground">{camera.name}</p>
                <div
                  className={`w-2 h-2 rounded-full ${camera.status === "online" ? "bg-primary" : "bg-destructive"}`}
                ></div>
              </div>
              <p className="text-sm text-foreground/60 capitalize">{camera.status}</p>
              {camera.incidents > 0 && (
                <p className="text-xs text-accent mt-2">{camera.incidents} incident(s) recorded</p>
              )}
            </div>
          ))}
        </div>
      </Card>
        </>
      )}

      {activeTab === "behavior" && (
        <div className="space-y-6">
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={behaviorScene === "classroom" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setBehaviorScene("classroom")}
              >
                <Building2 className="w-4 h-4" />
                Classroom — mobile / devices
              </Button>
              <Button
                type="button"
                variant={behaviorScene === "campus" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setBehaviorScene("campus")}
              >
                <Shield className="w-4 h-4" />
                Campus — weapons / hazards
              </Button>
            </div>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <BehaviorDetectionMonitor
                cameraId={behaviorCameraId}
                sceneTitle={behaviorScene === "classroom" ? "Classroom monitoring" : "Campus security patrol"}
                alertLocationLabel={behaviorScene === "classroom" ? "Classroom" : "Campus"}
                onRunningChange={setIsBehaviorCameraLive}
                onSessionStartedAtChange={setBehaviorSessionStartedAt}
                modelHint={
                  behaviorScene === "classroom"
                    ? "Tune your Roboflow model for phones and handheld devices in class. Alerts are tagged as Classroom."
                    : "Tune your Roboflow model for weapons and critical threats on campus grounds. Alerts are tagged as Campus."
                }
              />
            </div>
            <div>
              <BehaviorAlerts
                isLive={isBehaviorCameraLive}
                cameraId={behaviorCameraId}
                sessionStartedAt={behaviorSessionStartedAt}
                excludeTypes={["Vape Detection"]}
              />
            </div>
          </div>
          <BehaviorAnalytics />
        </div>
      )}

      {activeTab === "vape" && (
        <div className="space-y-6">
          <VapeDetectionMonitor />
        </div>
      )}
    </div>
  )
}
