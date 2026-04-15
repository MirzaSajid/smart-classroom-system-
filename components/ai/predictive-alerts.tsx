"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Zap, Clock } from "lucide-react"

interface PredictiveAlert {
  id: string
  title: string
  probability: number
  timeframe: string
  impact: "high" | "medium" | "low"
  recommendation: string
}

export function PredictiveAlerts() {
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    generatePredictions()
  }, [])

  const generatePredictions = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/ai/generate-predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeframe: "next-7-days",
          dataPoints: {
            historicalAttendance: [92, 94, 89, 96, 88],
            trends: "declining",
            seasonality: "mid-week-dip",
          },
        }),
      })

      if (!response.ok) {
        console.error("[v0] Predictions API error:", response.status, response.statusText)
        setAlerts([])
        return
      }

      const result = await response.json()
      if (result.predictions) {
        setAlerts(result.predictions)
      }
    } catch (error) {
      console.error("[v0] Prediction generation failed:", error)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent" />
          Predictive Alerts
        </h3>
        <button
          onClick={generatePredictions}
          disabled={loading}
          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Refresh"}
        </button>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-6">
            <Clock className="w-8 h-8 text-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-foreground/60">No alerts at this time</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="p-4 rounded-lg bg-card/50 border border-border hover:bg-card transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-foreground">{alert.title}</p>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    alert.impact === "high" ? "bg-destructive/20 text-destructive" : "bg-accent/20 text-accent"
                  }`}
                >
                  {Math.round(alert.probability * 100)}% likely
                </span>
              </div>
              <p className="text-sm text-foreground/70 mb-2">{alert.timeframe}</p>
              <p className="text-xs text-foreground/60 italic">💡 {alert.recommendation}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
