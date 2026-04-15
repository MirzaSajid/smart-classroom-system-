"use client"

import { Card } from "@/components/ui/card"
import { AlertTriangle, MapPin, Eye, AlertCircle, Video } from "lucide-react"
import { useState, useEffect } from "react"
import { BehaviorDetectionMonitor } from "@/components/behavior/behavior-detection-monitor"
import { BehaviorAlerts } from "@/components/behavior/behavior-alerts"
import { BehaviorAnalytics } from "@/components/behavior/behavior-analytics"

export function SecurityDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "behavior">("behavior")
  const [behaviorAlerts, setBehaviorAlerts] = useState<any[]>([])

  // Load YOLOv8 behavior alerts in real-time
  const loadAlerts = () => {
    const stored = localStorage.getItem('behaviorAlerts')
    if (stored) {
      try {
        const alerts = JSON.parse(stored)
        setBehaviorAlerts(alerts.slice(0, 10))
      } catch (e) {
        console.error('[v0] Failed to load behavior alerts:', e)
      }
    }
  }

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 2000)
    return () => clearInterval(interval)
  }, [])

  // All data now comes from real sources - no demo data
  const incidents = behaviorAlerts
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
                    {incident.severity.toUpperCase()}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <BehaviorDetectionMonitor cameraId="cam-01" />
            </div>
            <div>
              <BehaviorAlerts />
            </div>
          </div>
          <BehaviorAnalytics />
        </div>
      )}
    </div>
  )
}
