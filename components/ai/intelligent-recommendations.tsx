"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Lightbulb } from "lucide-react"

interface Recommendation {
  id: string
  category: string
  suggestion: string
  expectedBenefit: string
  priority: "high" | "medium" | "low"
}

export function IntelligentRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const fetchRecommendations = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/ai/get-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            role: "admin",
            systemHealth: "good",
            dataAvailable: true,
          },
        }),
      })

      if (!response.ok) {
        console.error("[v0] Recommendations API error:", response.status, response.statusText)
        setRecommendations([])
        return
      }

      const result = await response.json()
      if (result.recommendations) {
        setRecommendations(result.recommendations)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch recommendations:", error)
      setRecommendations([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          AI Recommendations
        </h3>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-6">
            <p className="text-sm text-foreground/60">Loading recommendations...</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-foreground/60">No recommendations available</p>
          </div>
        ) : (
          recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`p-4 rounded-lg border ${
                rec.priority === "high" ? "bg-primary/5 border-primary/30" : "bg-card/50 border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-2 bg-primary flex-shrink-0"></div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">{rec.category}</p>
                  <p className="text-sm text-foreground/70 mt-1">{rec.suggestion}</p>
                  <p className="text-xs text-foreground/60 mt-2">Expected benefit: {rec.expectedBenefit}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
