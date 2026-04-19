import { NextRequest } from "next/server"

import { normalizeBehaviorClass, normalizeBboxFromRoboflow } from "@/lib/behavior-class-map"

// API keys are kept secure on the server. Use a Roboflow Universe / workspace project
// (YOLOv5/v8/v11). Weights trained on Kaggle can be uploaded to Roboflow for hosted inference.
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY || ""
const ROBOFLOW_PROJECT_ID = process.env.ROBOFLOW_PROJECT_ID || ""
const ROBOFLOW_VERSION = process.env.ROBOFLOW_VERSION || "1"

// Helper to check if env vars are actually set (not placeholder strings)
function areApiKeysConfigured(): boolean {
  const hasValidApiKey = !!ROBOFLOW_API_KEY && !ROBOFLOW_API_KEY.includes('NEXT_PUBLIC')
  const hasValidProjectId = !!ROBOFLOW_PROJECT_ID && !ROBOFLOW_PROJECT_ID.includes('NEXT_PUBLIC')
  return hasValidApiKey && hasValidProjectId
}

// Severity mapping for canonical behavior classes (after normalizeBehaviorClass)
const BEHAVIOR_SEVERITY: Record<string, "low" | "medium" | "high" | "critical"> = {
  smoking: "high",
  vaping: "high",
  phone_use: "medium",
  mobile_use: "medium",
  weapon: "critical",
  fighting: "critical",
  unauthorized_person: "high",
  unauthorized_student: "medium",
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
            "Behavior detection is disabled. Set ROBOFLOW_API_KEY and ROBOFLOW_PROJECT_ID (and optional ROBOFLOW_VERSION) in .env, then restart. Use a Roboflow Universe model or upload Kaggle-trained YOLO weights to Roboflow Deploy.",
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

    const imgW = Math.round(Number(result?.image?.width)) || 640
    const imgH = Math.round(Number(result?.image?.height)) || 480

    // Parse Roboflow detections → canonical classes (COCO “cell phone”, weapon datasets, etc.)
    const detections = (result.predictions || []).map((pred: any) => {
      const rawClass = String(pred.class || "unknown")
      const canonical = normalizeBehaviorClass(rawClass)
      const bbox = normalizeBboxFromRoboflow(
        {
          x: Number(pred.x) || 0,
          y: Number(pred.y) || 0,
          width: Number(pred.width) || 0,
          height: Number(pred.height) || 0,
        },
        imgW,
        imgH,
      )
      return {
        class: canonical,
        severity: BEHAVIOR_SEVERITY[canonical] || "medium",
        confidence: Number(pred.confidence) || 0,
        bbox,
        timestamp: new Date().toISOString(),
      }
    })

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
