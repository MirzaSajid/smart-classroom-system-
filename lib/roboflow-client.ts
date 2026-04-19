// Roboflow YOLOv8 Model Client - Types and Utility Functions
// API key handling moved to server-side route for security

export interface DetectionResult {
  class: string
  confidence: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface FrameAnalysis {
  detections: DetectionResult[]
  timestamp: Date
  frameId: string
  processingTime: number
}

export interface BehaviorAlert {
  type: 'smoking' | 'vaping' | 'fighting' | 'phone_use' | 'unauthorized_student' | 'unauthorized_person' | 'weapon'
  severity: 'critical' | 'high' | 'medium' | 'low'
  confidence: number
  location: string
  cameraId: string
  timestamp: Date
  description: string
  requiresAction: boolean
}

// Severity mapping for different detected behaviors (aligned with yolov8-detect canonical classes)
const BEHAVIOR_SEVERITY_MAP: Record<string, "critical" | "high" | "medium"> = {
  weapon: "critical",
  fighting: "critical",
  vaping: "high",
  smoking: "high",
  unauthorized_person: "high",
  unauthorized_student: "medium",
  phone_use: "medium",
  mobile_use: "medium",
}

// Client-side function that calls server endpoint (API key stays on server)
export async function detectBehaviorsFromFrame(
  imageBase64: string,
  cameraId: string,
  frameId: string
): Promise<FrameAnalysis> {
  const startTime = Date.now()

  try {
    // Call our server endpoint which handles Roboflow API securely
    const response = await fetch('/api/behavior/yolov8-detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        cameraId,
        frameId,
      }),
    })

    if (!response.ok) {
      console.error('[v0] Detection error:', response.status, response.statusText)
      return {
        detections: [],
        timestamp: new Date(),
        frameId,
        processingTime: Date.now() - startTime,
      }
    }

    const result = await response.json()
    console.log('[v0] YOLOv8 detections:', result.detections?.length || 0, 'objects found')

    return {
      detections: result.detections || [],
      timestamp: new Date(),
      frameId,
      processingTime: Date.now() - startTime,
    }
  } catch (error) {
    console.error('[v0] Frame analysis error:', error)
    return {
      detections: [],
      timestamp: new Date(),
      frameId,
      processingTime: Date.now() - startTime,
    }
  }
}

export function generateAlertsFromDetections(
  detections: DetectionResult[],
  cameraId: string,
  confidenceThreshold: number = 0.6
): BehaviorAlert[] {
  const alerts: BehaviorAlert[] = []

  detections.forEach((detection) => {
    if (detection.confidence < confidenceThreshold) {
      return
    }

    const behaviorType = detection.class.toLowerCase().replace(/\s+/g, '_') as keyof typeof BEHAVIOR_SEVERITY_MAP
    const severity = BEHAVIOR_SEVERITY_MAP[behaviorType] || 'medium'

    const alert: BehaviorAlert = {
      type: behaviorType as any,
      severity,
      confidence: detection.confidence,
      location: `Camera ${cameraId} - Zone ${Math.floor(detection.bbox.x / 100)}`,
      cameraId,
      timestamp: new Date(),
      description: generateAlertDescription(behaviorType, detection.confidence),
      requiresAction: severity === 'critical' || severity === 'high',
    }

    alerts.push(alert)
  })

  return alerts
}

function generateAlertDescription(behavior: string, confidence: number): string {
  const confidencePercent = Math.round(confidence * 100)
  
  const descriptions: Record<string, string> = {
    smoking: `Smoking detected with ${confidencePercent}% confidence. Immediate action required.`,
    vaping: `Vaping detected with ${confidencePercent}% confidence. Monitor and alert staff.`,
    fighting: `Physical altercation detected with ${confidencePercent}% confidence. Critical alert!`,
    phone_use: `Student using mobile device with ${confidencePercent}% confidence. Log for teacher.`,
    unauthorized_student: `Unauthorized student in restricted area with ${confidencePercent}% confidence.`,
    unauthorized_person: `Unauthorized person detected with ${confidencePercent}% confidence. Alert security immediately.`,
    weapon: `Potential weapon detected with ${confidencePercent}% confidence. CRITICAL SECURITY ALERT!`,
  }

  return descriptions[behavior] || `Behavior detected: ${behavior} (${confidencePercent}% confidence)`
}

export async function logAlertToDatabase(alert: BehaviorAlert): Promise<void> {
  try {
    // Store alert in localStorage for now, can be upgraded to proper database
    const alerts = localStorage.getItem('behaviorAlerts')
    const alertList = alerts ? JSON.parse(alerts) : []
    alertList.push({
      ...alert,
      timestamp: alert.timestamp.toISOString(),
    })
    localStorage.setItem('behaviorAlerts', JSON.stringify(alertList))
    console.log('[v0] Alert logged:', alert.type, alert.severity)
  } catch (error) {
    console.error('[v0] Failed to log alert:', error)
  }
}

export function getAlertRouter(alert: BehaviorAlert): {
  recipients: string[]
  notificationType: string
} {
  // Route alerts based on severity and type
  if (alert.severity === 'critical') {
    return {
      recipients: ['security', 'admin', 'police'],
      notificationType: 'emergency',
    }
  } else if (alert.severity === 'high') {
    return {
      recipients: ['security', 'admin'],
      notificationType: 'urgent',
    }
  } else {
    return {
      recipients: ['admin', 'teacher'],
      notificationType: 'warning',
    }
  }
}
