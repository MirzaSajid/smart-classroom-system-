'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  AlertTriangle,
  AlertCircle,
  Bell,
  Clock,
  MapPin,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BehaviorAlert {
  id: string
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  camera: string
  location: string
  timestamp: Date
  description: string
  resolved: boolean
}

type BehaviorAlertsProps = {
  isLive?: boolean
  cameraId?: string
  sessionStartedAt?: number | null
  excludeTypes?: string[]
}

export function BehaviorAlerts({
  isLive = false,
  cameraId,
  sessionStartedAt = null,
  excludeTypes = ['Vape Detection'],
}: BehaviorAlertsProps) {
  const [alerts, setAlerts] = useState<BehaviorAlert[]>([])
  const [notification, setNotification] = useState<BehaviorAlert | null>(null)
  const lastNotifiedIdRef = useRef<string | null>(null)

  // Load real-time alerts from localStorage and YOLOv8 detection
  useEffect(() => {
    if (!isLive) {
      setAlerts([])
      setNotification(null)
      lastNotifiedIdRef.current = null
      return
    }

    const loadAlerts = () => {
      const stored = localStorage.getItem('behaviorAlerts')
      if (stored) {
        try {
          const parsedAlerts = JSON.parse(stored)
            .filter((alert: any) => {
              const matchesCamera = cameraId ? alert.cameraId === cameraId : true
              const startedAfter =
                sessionStartedAt != null
                  ? new Date(alert.timestamp || 0).getTime() >= sessionStartedAt
                  : true
              const excluded = excludeTypes.some(
                (type) => String(alert.type || '').toLowerCase() === type.toLowerCase(),
              )
              return matchesCamera && startedAfter && !excluded
            })
            .map((alert: any) => ({
              id: String(alert.id ?? `alert-${alert.timestamp}-${alert.cameraId ?? 'cam'}`),
              type: String(alert.type || 'unknown').replace(/_/g, ' ').toUpperCase(),
              severity: alert.severity,
              camera: alert.cameraId,
              location: alert.location,
              timestamp: new Date(alert.timestamp),
              description: alert.description,
              resolved: false,
            }))
            .sort((a: BehaviorAlert, b: BehaviorAlert) => b.timestamp.getTime() - a.timestamp.getTime())

          setAlerts(parsedAlerts.slice(0, 20))

          // Show notification for a new latest alert if it's critical or high severity
          const latestAlert = parsedAlerts[0]
          if (
            latestAlert &&
            lastNotifiedIdRef.current !== latestAlert.id &&
            (latestAlert.severity === 'critical' || latestAlert.severity === 'high')
          ) {
            lastNotifiedIdRef.current = latestAlert.id
            setNotification(latestAlert)
            setTimeout(() => setNotification(null), 7000)
          }
        } catch (e) {
          console.error('[v0] Failed to load alerts:', e)
        }
      }
    }

    // Load immediately and then poll for new alerts every 2 seconds
    loadAlerts()
    const interval = setInterval(loadAlerts, 2000)

    return () => clearInterval(interval)
  }, [cameraId, excludeTypes, isLive, sessionStartedAt])

  const resolveAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, resolved: true } : alert
      )
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-900/20 border-red-500/50 text-red-200'
      case 'high':
        return 'bg-orange-900/20 border-orange-500/50 text-orange-200'
      case 'medium':
        return 'bg-yellow-900/20 border-yellow-500/50 text-yellow-200'
      default:
        return 'bg-blue-900/20 border-blue-500/50 text-blue-200'
    }
  }

  const getSeverityIcon = (severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="w-5 h-5" />
    return <AlertCircle className="w-5 h-5" />
  }

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-lg border shadow-lg animate-in slide-in-from-right max-w-md ${getSeverityColor(
            notification.severity
          )}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {getSeverityIcon(notification.severity)}
              <div>
                <h4 className="font-bold">{notification.type} Detected</h4>
                <p className="text-sm opacity-90">{notification.description}</p>
                <div className="flex items-center gap-2 text-xs mt-2 opacity-75">
                  <MapPin className="w-3 h-3" />
                  {notification.location}
                </div>
              </div>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="opacity-50 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Alerts Summary */}
      <Card className="p-4 bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Real-Time Behavior Alerts
          </h3>
          <div className="flex gap-2 text-sm">
            <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full">
              Critical: {alerts.filter((a) => a.severity === 'critical').length}
            </span>
            <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full">
              High: {alerts.filter((a) => a.severity === 'high').length}
            </span>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No alerts at this time</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded border ${getSeverityColor(
                  alert.severity
                )} ${alert.resolved ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{alert.type}</span>
                      <span className="text-xs px-2 py-0.5 bg-black/30 rounded">
                        {alert.severity.toUpperCase()}
                      </span>
                      {alert.resolved && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded">
                          RESOLVED
                        </span>
                      )}
                    </div>
                    <p className="text-sm opacity-85 mb-2">{alert.description}</p>
                    <div className="flex items-center gap-4 text-xs opacity-75">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {alert.location} ({alert.camera})
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {alert.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  {!alert.resolved && (
                    <Button
                      onClick={() => resolveAlert(alert.id)}
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
