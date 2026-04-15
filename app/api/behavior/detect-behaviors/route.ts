import { NextRequest } from 'next/server'
import { detectBehaviorsFromFrame, generateAlertsFromDetections, logAlertToDatabase, getAlertRouter } from '@/lib/roboflow-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageData, cameraId, frameId } = body

    if (!imageData || !cameraId) {
      return Response.json(
        { error: 'Image data and camera ID are required' },
        { status: 400 }
      )
    }

    // Extract base64 from data URL if needed
    const base64Image = imageData.includes('base64,') 
      ? imageData.split('base64,')[1] 
      : imageData

    console.log('[v0] Processing frame from camera:', cameraId)

    // Call YOLOv8 model via Roboflow API
    const frameAnalysis = await detectBehaviorsFromFrame(
      base64Image,
      cameraId,
      frameId || `frame-${Date.now()}`
    )

    // Generate alerts from detections with 60% confidence threshold
    const behaviorAlerts = generateAlertsFromDetections(
      frameAnalysis.detections,
      cameraId,
      0.6
    )

    // Process each alert
    for (const alert of behaviorAlerts) {
      // Log to database
      await logAlertToDatabase(alert)

      // Get routing information
      const routing = getAlertRouter(alert)
      
      console.log('[v0] Alert generated:', {
        type: alert.type,
        severity: alert.severity,
        confidence: alert.confidence,
        recipients: routing.recipients,
      })
    }

    return Response.json({
      success: true,
      cameraId,
      timestamp: frameAnalysis.timestamp.toISOString(),
      detections: frameAnalysis.detections,
      alerts: behaviorAlerts,
      frameProcessed: true,
      processingTime: frameAnalysis.processingTime,
    })
  } catch (error) {
    console.error('[v0] Behavior detection error:', error)
    return Response.json(
      { error: 'Failed to process frame', detections: [], alerts: [] },
      { status: 500 }
    )
  }
}
