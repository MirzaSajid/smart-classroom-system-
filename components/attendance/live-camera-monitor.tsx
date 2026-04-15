"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, Video, Camera } from "lucide-react"
import { FaceRecognitionCamera } from "./face-recognition-camera"

interface Camera {
  id: string
  name: string
  classId: string
  location: string
  status: "active" | "inactive" | "offline"
  model: string
}

interface LiveCameraMonitorProps {
  classId: string
  className: string
}

export function LiveCameraMonitor({ classId, className }: LiveCameraMonitorProps) {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [activeCameraId, setActiveCameraId] = useState<string>("")
  const [autoAttendanceEnabled, setAutoAttendanceEnabled] = useState(true)
  const [attendanceCount, setAttendanceCount] = useState(0)
  const [markedStudents, setMarkedStudents] = useState<any[]>([])

  useEffect(() => {
    const cameraData = localStorage.getItem("camerasData")
    if (cameraData) {
      try {
        const allCameras = JSON.parse(cameraData)
        const classCameras = allCameras.filter((c: Camera) => c.classId === classId && c.status === "active")
        setCameras(classCameras)
        if (classCameras.length > 0) {
          setActiveCameraId(classCameras[0].id)
        }
      } catch (e) {
        console.error("[v0] Failed to load cameras:", e)
      }
    }
  }, [classId])

  const handleAttendanceMarked = (student: any) => {
    setMarkedStudents((prev) => {
      const exists = prev.find((s) => s.id === student.id)
      if (!exists) {
        setAttendanceCount((c) => c + 1)
        return [...prev, student]
      }
      return prev
    })
  }

  const getActiveCamera = () => cameras.find((c) => c.id === activeCameraId)

  if (cameras.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Camera className="w-12 h-12 text-foreground/40 mx-auto mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">No Cameras Available</p>
        <p className="text-foreground/60">
          No active cameras are installed in {className}. Set up cameras in Camera Setup tab.
        </p>
      </Card>
    )
  }

  const activeCamera = getActiveCamera()

  return (
    <div className="space-y-4">
      {/* Camera Selector */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Active Camera Feed
          </h3>
          <Badge className="bg-green-500/20 text-green-700">LIVE</Badge>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {cameras.map((camera) => (
            <Button
              key={camera.id}
              variant={activeCameraId === camera.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCameraId(camera.id)}
              className="flex items-center gap-2"
            >
              <Video className="w-4 h-4" />
              {camera.name}
            </Button>
          ))}
        </div>

        {activeCamera && (
          <div className="p-3 bg-background/50 rounded border border-border text-sm text-foreground/70">
            <p>
              <span className="font-semibold">Location:</span> {activeCamera.location}
            </p>
            <p>
              <span className="font-semibold">Model:</span> {activeCamera.model}
            </p>
          </div>
        )}
      </Card>

      {/* Auto Attendance Toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">Automatic Attendance Marking</p>
            <p className="text-sm text-foreground/60">
              {autoAttendanceEnabled
                ? "Faces detected will be automatically marked as present"
                : "Manual attendance marking only"}
            </p>
          </div>
          <Button
            variant={autoAttendanceEnabled ? "default" : "outline"}
            onClick={() => setAutoAttendanceEnabled(!autoAttendanceEnabled)}
          >
            {autoAttendanceEnabled ? "Enabled" : "Disabled"}
          </Button>
        </div>
      </Card>

      {/* Live Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-primary">{attendanceCount}</p>
          <p className="text-sm text-foreground/60 mt-2">Students Detected</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-primary">{cameras.length}</p>
          <p className="text-sm text-foreground/60 mt-2">Active Cameras</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-primary flex items-center justify-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            Live
          </p>
          <p className="text-sm text-foreground/60 mt-2">Feed Status</p>
        </Card>
      </div>

      {/* Camera Feed */}
      {activeCamera && autoAttendanceEnabled && (
        <Card className="p-4">
          <p className="text-sm font-semibold text-foreground mb-3">
            Live Recognition Feed - {activeCamera.name}
          </p>
          <FaceRecognitionCamera
            onAttendanceMarked={handleAttendanceMarked}
            isActive={true}
            classStartTime={new Date()}
            autoMarkAfterMinutes={10}
            classId={classId}
          />
        </Card>
      )}

      {/* Detected Students */}
      <Card className="p-4">
        <p className="font-semibold text-foreground mb-3">Recognized Students ({markedStudents.length})</p>
        {markedStudents.length === 0 ? (
          <div className="p-8 text-center bg-background/50 rounded border border-dashed border-border">
            <AlertCircle className="w-8 h-8 text-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-foreground/60">No students recognized yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {markedStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-3 bg-background rounded border border-green-200 bg-green-50/50"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-foreground">{student.name}</p>
                    <p className="text-xs text-foreground/60">
                      Detected at {student.timestamp?.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-500/20 text-green-700">
                  {Math.round(student.confidence * 100)}% Match
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
