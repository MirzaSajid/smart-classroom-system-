# Behavior Detection Setup Guide

## Overview
The behavior detection system uses YOLOv8 via Roboflow to detect behaviors on campus:
- Smoking
- Vaping  
- Mobile/Phone use
- Weapons
- Fighting/Altercations
- Unauthorized persons
- Unauthorized students in class

## Current Status
**Demo Mode Active** - The system is currently running in demo mode with simulated detections for testing purposes.

## Setup for Real Detection

### Option 1: Using Roboflow (Recommended)

1. **Create a Roboflow Account**
   - Visit https://roboflow.com
   - Sign up for free
   - Create a new project

2. **Train Your YOLOv8 Model**
   - Upload training images of behaviors you want to detect
   - Label images with behavior annotations
   - Use Roboflow's labeling interface to create bounding boxes
   - Train the YOLOv8 model with your custom dataset

3. **Get API Credentials**
   - After training, go to your project's Deploy section
   - Copy your:
     - API Key (keep this secret)
     - Project ID
     - Model Version (usually "1" for the first version)

4. **Configure Environment Variables**
   - In the Vercel Dashboard > Settings > Environment Variables, add:
     ```
     ROBOFLOW_API_KEY=your_api_key_here
     ROBOFLOW_PROJECT_ID=your_project_id_here
     ROBOFLOW_VERSION=1
     ```

5. **Redeploy**
   - The system will automatically use real YOLOv8 detection instead of demo mode

### Option 2: Use Demo Mode for Testing
- Currently enabled automatically if API keys aren't configured
- Simulates realistic behavior detections with 30% detection rate
- Perfect for testing the alert system and UI

## Testing Behavior Detection

1. **Start Behavior Monitor**
   - Open the Security Dashboard
   - Click on "Behavior Detection" tab
   - Click "Start Monitoring"

2. **Point Camera**
   - Ensure camera is pointed at area where behaviors occur
   - In demo mode, detections will be simulated
   - In real mode, YOLOv8 will analyze actual video frames

3. **View Detections**
   - Live detections appear on the video feed with bounding boxes
   - Severity level shown (critical, high, medium)
   - Confidence scores displayed

4. **Check Alerts**
   - Navigate to Security Dashboard > Alerts
   - View detailed alert history
   - Severity-based routing:
     - Critical (weapons, fighting) → Police + Security + Admin
     - High (smoking, vaping, unauthorized) → Security + Admin
     - Medium (phone use, suspicious behavior) → Admin + Teacher

## Detection Classes

| Behavior | Severity | Action |
|----------|----------|--------|
| Weapon | Critical | Immediate police notification |
| Fighting | Critical | Police + Security response |
| Smoking | High | Security + Admin alert |
| Vaping | High | Security + Admin alert |
| Unauthorized Person | High | Security investigation |
| Mobile Use | Medium | Admin notification |
| Unauthorized Student | Medium | Teacher + Admin notification |

## Troubleshooting

### Detections Not Working
1. Check if API keys are configured: `ROBOFLOW_API_KEY` and `ROBOFLOW_PROJECT_ID`
2. Ensure browser camera permissions are enabled
3. Check Security Dashboard > Behavior Detection logs for errors
4. Verify Roboflow project is trained and deployed

### False Positives/Negatives
- Improve YOLOv8 model by training with more diverse images
- Adjust detection threshold (currently 60%)
- Ensure good lighting and camera angles
- Train on different weather conditions if outdoors

### Performance Issues
- Increase frame sampling interval (currently processes every 5th frame)
- Reduce video resolution
- Use fewer cameras
- Check network bandwidth to Roboflow API

## Architecture

```
Camera Feed
    ↓
Browser Canvas (extracts frames)
    ↓
/api/behavior/yolov8-detect
    ↓
Roboflow YOLOv8 API (or Demo Mode)
    ↓
Detection Results (class, confidence, bounding box)
    ↓
Alert Generation & Routing
    ↓
Security Dashboard + Notifications
```

## API Endpoints

### POST /api/behavior/yolov8-detect
Processes a single frame through YOLOv8 model
```json
Request:
{
  "imageBase64": "data:image/jpeg;base64,...",
  "cameraId": "cam-01",
  "frameId": "frame-123"
}

Response:
{
  "success": true,
  "detections": [
    {
      "class": "smoking",
      "confidence": 0.87,
      "bbox": { "x": 10, "y": 20, "width": 50, "height": 70 }
    }
  ],
  "processingTime": 45
}
```

### POST /api/behavior/detect-behaviors
Higher-level endpoint for complete behavior detection workflow
```json
Request:
{
  "imageData": "data:image/jpeg;base64,...",
  "cameraId": "cam-01"
}

Response:
{
  "success": true,
  "detections": [...],
  "alerts": [...],
  "processingTime": 45
}
```
