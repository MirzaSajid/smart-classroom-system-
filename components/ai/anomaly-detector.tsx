"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, TrendingDown } from "lucide-react"

interface Anomaly {
  id: string
  type: "attendance" | "behavior" | "security"
  severity: "high" | "medium" | "low"
  description: string
  confidence: number
  timestamp: string
  action?: string
}

export function AnomalyDetector() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    detectAnomalies()
  }, [])

  const detectAnomalies = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/ai/detect-anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            attendancePatterns: [92, 94, 89, 96, 88, 45], // Simulated data with anomaly
            behaviorMetrics: [7.2, 7.5, 7.1, 6.8, 8.2, 2.1],
            securityEvents: [0, 0, 1, 0, 0, 5],
          },
        }),
      })

      if (!response.ok) {
        console.error("[v0] Anomalies API error:", response.status, response.statusText)
        setAnomalies([])
        return
      }

      const result = await response.json()
      if (result.anomalies) {
        setAnomalies(result.anomalies)
      }
    } catch (error) {
      console.error("[v0] Anomaly detection failed:", error)
      setAnomalies([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">AI Anomaly Detection</h3>
        <button
          onClick={detectAnomalies}
          disabled={loading}
          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      <div className="space-y-3">
        {anomalies.length === 0 ? (
          <div className="text-center py-8">
            <TrendingDown className="w-8 h-8 text-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-foreground/60">No anomalies detected</p>
          </div>
        ) : (
          anomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className={`p-4 rounded-lg border ${
                anomaly.severity === "high" ? "bg-destructive/5 border-destructive/30" : "bg-accent/5 border-accent/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  className={`w-5 h-5 mt-0.5 ${anomaly.severity === "high" ? "text-destructive" : "text-accent"}`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground capitalize">{anomaly.type}</p>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(anomaly.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground/70">{anomaly.description}</p>
                  {anomaly.action && <p className="text-xs text-foreground/60 mt-2">Recommended: {anomaly.action}</p>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
