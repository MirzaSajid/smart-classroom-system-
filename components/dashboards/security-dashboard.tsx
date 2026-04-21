"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, MapPin, Eye, AlertCircle, Video, Building2, Shield } from "lucide-react"
import { useMemo, useState, useEffect } from "react"
import { BehaviorDetectionMonitor } from "@/components/behavior/behavior-detection-monitor"
import { BehaviorAlerts } from "@/components/behavior/behavior-alerts"
import { BehaviorAnalytics } from "@/components/behavior/behavior-analytics"
import { VapeDetectionMonitor } from "../security/vape-detection-monitor"

type SecurityIncident = {
  id: string
  type: string
  location: string
  severity: string
  time: string
  details: string
  status: string
  fineInvoiceId?: string
  invoiceCategory?: string
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
    fineInvoiceId: typeof raw.fineInvoiceId === "string" ? raw.fineInvoiceId : undefined,
    invoiceCategory: typeof raw.invoiceCategory === "string" ? raw.invoiceCategory : undefined,
  }
}

export function SecurityDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "behavior" | "vape">("behavior")
  const [behaviorScene, setBehaviorScene] = useState<"classroom" | "campus">("campus")
  const [isBehaviorCameraLive, setIsBehaviorCameraLive] = useState(false)
  const [behaviorSessionStartedAt, setBehaviorSessionStartedAt] = useState<number | null>(null)
  const [behaviorAlerts, setBehaviorAlerts] = useState<SecurityIncident[]>([])
  const behaviorCameraId = behaviorScene === "classroom" ? "classroom-cam-01" : "campus-patrol-01"
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "monitoring">("all")
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all")
  const [query, setQuery] = useState("")

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

  const filteredIncidents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return incidents.filter((i) => {
      const statusOk =
        statusFilter === "all" ? true : statusFilter === "active" ? i.status === "Active" : i.status === "Monitoring"
      const severityOk = severityFilter === "all" ? true : String(i.severity).toLowerCase() === severityFilter
      const queryOk =
        !q ||
        `${i.type} ${i.location} ${i.details} ${i.status} ${i.time}`.toLowerCase().includes(q)
      return statusOk && severityOk && queryOk
    })
  }, [incidents, query, severityFilter, statusFilter])

  const counts = useMemo(() => {
    const active = incidents.filter((i) => i.status === "Active").length
    const monitoring = incidents.filter((i) => i.status === "Monitoring").length
    const total = incidents.length
    return { active, monitoring, total }
  }, [incidents])

  const jumpToIncidents = (nextStatus: typeof statusFilter, nextSeverity: typeof severityFilter = "all") => {
    setStatusFilter(nextStatus)
    setSeverityFilter(nextSeverity)
    setActiveTab("overview")
  }

  const clearAllIncidents = () => {
    const ok = window.confirm("Clear all incidents? This will remove all stored security incidents.")
    if (!ok) return
    localStorage.removeItem("behaviorAlerts")
    setBehaviorAlerts([])
    setQuery("")
    setStatusFilter("all")
    setSeverityFilter("all")
  }

  const openChallan = (invoiceId?: string) => {
    if (!invoiceId) return
    localStorage.setItem("openFeeInvoiceId", invoiceId)
    localStorage.setItem("openAdminTab", "fees")
    window.alert(`Challan ${invoiceId} queued. Switch to Admin > Fees to open it.`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Security Dashboard</h2>
          <p className="text-foreground/60">Real-time campus monitoring and incident tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-transparent">
            Incidents: {counts.total}
          </Badge>
          <Badge variant="outline" className="bg-transparent">
            Active: {counts.active}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-2xl">
          <TabsTrigger value="overview" className="gap-2">
            <Eye className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-2">
            <Video className="w-4 h-4" />
            Behavior
          </TabsTrigger>
          <TabsTrigger value="vape" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Vape
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 animate-in fade-in-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card
              variant="glass"
              className="p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => jumpToIncidents("active")}
              role="button"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Active Incidents</p>
                  <p className="text-2xl font-bold text-destructive">{counts.active}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-destructive/40" />
              </div>
            </Card>
            <Card
              variant="glass"
              className="p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => jumpToIncidents("monitoring")}
              role="button"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Monitoring</p>
                  <p className="text-2xl font-bold text-accent">{counts.monitoring}</p>
                </div>
                <Eye className="w-8 h-8 text-accent/40" />
              </div>
            </Card>
            <Card
              variant="glass"
              className="p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => jumpToIncidents("all")}
              role="button"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Total Incidents</p>
                  <p className="text-2xl font-bold text-primary">{counts.total}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
            <Card variant="glass" className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Cameras Online</p>
                  <p className="text-2xl font-bold text-foreground">
                    {cameras.filter((c) => c.status === "online").length}/{cameras.length}
                  </p>
                </div>
                <MapPin className="w-8 h-8 text-foreground/40" />
              </div>
            </Card>
          </div>

          <Card variant="glass" className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Incidents</h3>
                <p className="text-sm text-foreground/60">Search, filter, and drill down into events.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search incidents…"
                  className="w-64 bg-[var(--glass-bg)] border-[var(--glass-border)]"
                />
                <Button
                  size="sm"
                  variant={statusFilter === "all" ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "active" ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setStatusFilter("active")}
                >
                  Active
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "monitoring" ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setStatusFilter("monitoring")}
                >
                  Monitoring
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setQuery("")
                    setStatusFilter("all")
                    setSeverityFilter("all")
                  }}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-xl"
                  onClick={clearAllIncidents}
                  disabled={incidents.length === 0}
                >
                  Clear all incidents
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "critical", "high", "medium", "low"] as const).map((sev) => (
                <Button
                  key={sev}
                  size="sm"
                  variant={severityFilter === sev ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setSeverityFilter(sev)}
                >
                  {sev === "all" ? "All severities" : sev.toUpperCase()}
                </Button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredIncidents.length === 0 ? (
                <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 text-sm text-foreground/60">
                  No incidents match your filters.
                </div>
              ) : (
                filteredIncidents.map((incident) => {
                  const sev = String(incident.severity).toLowerCase()
                  const sevStyle =
                    sev === "critical"
                      ? "border-destructive/35 bg-destructive/10"
                      : sev === "high"
                        ? "border-destructive/20 bg-destructive/5"
                        : "border-[var(--glass-border)] bg-[var(--glass-bg)]"
                  return (
                    <div
                      key={incident.id}
                      className={`p-4 rounded-xl border backdrop-blur-xl transition-shadow hover:shadow-md ${sevStyle}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{incident.type}</p>
                          <p className="text-sm text-foreground/60 flex items-center gap-1 mt-1">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate">{incident.location}</span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-medium px-2 py-1 rounded bg-black/5 dark:bg-white/5">
                            {String(incident.severity).toUpperCase()}
                          </span>
                          <p className="text-xs text-foreground/50 mt-1">{incident.time}</p>
                        </div>
                      </div>
                      {incident.details ? (
                        <p className="text-sm text-foreground/70 mt-3">{incident.details}</p>
                      ) : null}
                      {incident.fineInvoiceId ? (
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="bg-transparent">
                            Challan: {incident.fineInvoiceId}
                          </Badge>
                          {incident.invoiceCategory ? (
                            <Badge variant="outline" className="bg-transparent">
                              {incident.invoiceCategory}
                            </Badge>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => openChallan(incident.fineInvoiceId)}>
                            Open challan
                          </Button>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 mt-3">
                        <span className="inline-block w-2 h-2 rounded-full bg-accent"></span>
                        <p className="text-xs text-foreground/60">{incident.status}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-6 animate-in fade-in-0">
          <Card variant="glass" className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={behaviorScene === "classroom" ? "default" : "outline"}
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => setBehaviorScene("classroom")}
              >
                <Building2 className="w-4 h-4" />
                Classroom — mobile / devices
              </Button>
              <Button
                type="button"
                variant={behaviorScene === "campus" ? "default" : "outline"}
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => setBehaviorScene("campus")}
              >
                <Shield className="w-4 h-4" />
                Campus — weapons / hazards
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className="bg-transparent">
                  Camera: {behaviorCameraId}
                </Badge>
                <Badge variant={isBehaviorCameraLive ? "default" : "outline"} className="bg-transparent">
                  {isBehaviorCameraLive ? "LIVE" : "OFF"}
                </Badge>
              </div>
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
        </TabsContent>

        <TabsContent value="vape" className="space-y-6 animate-in fade-in-0">
          <VapeDetectionMonitor />
        </TabsContent>
      </Tabs>
    </div>
  )
}
