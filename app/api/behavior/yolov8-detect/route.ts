import { NextRequest } from 'next/server'

// API keys are kept secure on the server
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY || ''
const ROBOFLOW_PROJECT_ID = process.env.ROBOFLOW_PROJECT_ID || ''
const ROBOFLOW_VERSION = process.env.ROBOFLOW_VERSION || '1'

// Helper to check if env vars are actually set (not placeholder strings)
function areApiKeysConfigured(): boolean {
  const hasValidApiKey = !!ROBOFLOW_API_KEY && !ROBOFLOW_API_KEY.includes('NEXT_PUBLIC')
  const hasValidProjectId = !!ROBOFLOW_PROJECT_ID && !ROBOFLOW_PROJECT_ID.includes('NEXT_PUBLIC')
  return hasValidApiKey && hasValidProjectId
}

// Severity mapping for behaviors
const BEHAVIOR_SEVERITY: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  'smoking': 'high',
  'vaping': 'high',
  'mobile_use': 'medium',
  'weapon': 'critical',
  'fighting': 'critical',
  'unauthorized_person': 'high',
  'unauthorized_student': 'medium',
}

// Demo mode - simulates behavior detection for testing without Roboflow API
function generateDemoBehaviorDetections() {
  const behaviors = [
    { class: 'smoking', confidence: 0.87 },
    { class: 'vaping', confidence: 0.82 },
    { class: 'mobile_use', confidence: 0.75 },
    { class: 'weapon', confidence: 0.91 },
    { class: 'fighting', confidence: 0.84 },
    { class: 'unauthorized_person', confidence: 0.79 },
  ]

  // 40% chance of detecting a behavior each call (higher for demo visibility)
  const detected = behaviors.filter(() => Math.random() < 0.4)
  
  return detected.map((behavior) => ({
    class: behavior.class,
    severity: BEHAVIOR_SEVERITY[behavior.class] || 'medium',
    confidence: Math.max(0.6, Math.min(0.99, behavior.confidence + Math.random() * 0.1 - 0.05)),
    bbox: {
      x: Math.random() * 100,
      y: Math.random() * 100,
      width: 20 + Math.random() * 40,
      height: 30 + Math.random() * 50,
    },
    timestamp: new Date().toISOString(),
  }))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, cameraId, frameId } = body

    if (!imageBase64) {
      return Response.json(
        { error: 'Image data is required' },
        { status: 400 }
      )
    }

    // If API keys not configured, do NOT fall back to demo mode.
    // Behavior detection in production should be real; demo mode is only for development.
    if (!areApiKeysConfigured()) {
      console.warn('[v0] Roboflow API keys not configured. Behavior detection disabled.')
      return Response.json(
        {
          success: false,
          detections: [],
          alerts: [],
          cameraId,
          frameId,
          mode: 'disabled',
          message:
            'Behavior detection is disabled. Set ROBOFLOW_API_KEY and ROBOFLOW_PROJECT_ID in .env and restart the server.',
        },
        { status: 503 },
      )
    }

    console.log('[v0] Processing YOLOv8 detection for camera:', cameraId)

    // Call Roboflow API securely from server
    const response = await fetch(
      `https://detect.roboflow.com/${ROBOFLOW_PROJECT_ID}/${ROBOFLOW_VERSION}?api_key=${ROBOFLOW_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `imageBase64=${encodeURIComponent(imageBase64)}`,
      }
    )

    if (!response.ok) {
      console.error('[v0] Roboflow API error:', response.status, response.statusText)
      return Response.json(
        {
          success: false,
          detections: [],
          alerts: [],
          cameraId,
          frameId,
          mode: 'error',
          message: `Roboflow API error: ${response.status} ${response.statusText}`,
        },
        { status: 502 },
      )
    }

    let result
    try {
      result = await response.json()
    } catch (parseError) {
      console.error('[v0] Failed to parse Roboflow response as JSON:', parseError)
      return Response.json(
        {
          success: false,
          detections: [],
          alerts: [],
          cameraId,
          frameId,
          mode: 'error',
          message: 'Failed to parse Roboflow response as JSON',
        },
        { status: 502 },
      )
    }

    // Parse Roboflow detections
    const detections = (result.predictions || []).map((pred: any) => ({
      class: pred.class || 'unknown',
      severity: BEHAVIOR_SEVERITY[pred.class] || 'medium',
      confidence: pred.confidence || 0,
      bbox: {
        x: pred.x || 0,
        y: pred.y || 0,
        width: pred.width || 0,
        height: pred.height || 0,
      },
      timestamp: new Date().toISOString(),
    }))

    return Response.json({
      success: true,
      detections,
      alerts: detections.filter((d: any) => d.confidence >= 0.6),
      cameraId,
      frameId,
      processingTime: result.inference_time || 0,
      mode: 'roboflow',
    })
  } catch (error) {
    console.error('[v0] YOLOv8 detection error:', error)
    return Response.json(
      { success: false, detections: [], alerts: [], mode: 'error', message: 'Detection error occurred' },
      { status: 500 },
    )
  }
}
