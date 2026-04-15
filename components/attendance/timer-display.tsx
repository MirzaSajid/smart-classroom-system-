"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { AlertCircle, Clock, CheckCircle } from "lucide-react"

interface TimerDisplayProps {
  timeRemaining: number
  isExpired: boolean
  onTimeExpired?: () => void
}

export function TimerDisplay({ timeRemaining, isExpired, onTimeExpired }: TimerDisplayProps) {
  const [warningLevel, setWarningLevel] = useState<"normal" | "warning" | "critical" | "expired">("normal")

  useEffect(() => {
    if (isExpired) {
      setWarningLevel("expired")
    } else if (timeRemaining < 30) {
      setWarningLevel("critical")
    } else if (timeRemaining < 120) {
      setWarningLevel("warning")
    } else {
      setWarningLevel("normal")
    }
  }, [timeRemaining, isExpired])

  useEffect(() => {
    if (isExpired && onTimeExpired) {
      onTimeExpired()
    }
  }, [isExpired, onTimeExpired])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getTimerStyles = () => {
    switch (warningLevel) {
      case "critical":
        return "bg-destructive/10 border-destructive/30 text-destructive"
      case "warning":
        return "bg-accent/10 border-accent/30 text-accent"
      case "expired":
        return "bg-destructive/20 border-destructive/40 text-destructive"
      default:
        return "bg-primary/10 border-primary/30 text-primary"
    }
  }

  return (
    <div className="space-y-2">
      <Card className={`p-4 border-2 ${getTimerStyles()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {warningLevel === "expired" ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            <span className="font-semibold">Attendance Window</span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold">{formatTime(timeRemaining)}</div>
            <p className="text-xs opacity-70">{isExpired ? "Expired" : "Remaining"}</p>
          </div>
        </div>
      </Card>

      {warningLevel === "critical" && !isExpired && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">
            Less than 30 seconds remaining. Attendance window will close automatically.
          </p>
        </div>
      )}

      {warningLevel === "warning" && !isExpired && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 flex items-start gap-2">
          <Clock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-sm text-accent">Less than 2 minutes remaining. Complete attendance marking soon.</p>
        </div>
      )}

      {isExpired && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive font-medium">
            Attendance window has closed. The session will be saved automatically.
          </p>
        </div>
      )}
    </div>
  )
}
