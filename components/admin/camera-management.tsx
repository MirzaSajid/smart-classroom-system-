"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, Save, X, Camera, Video, MapPin, CheckCircle, AlertCircle } from "lucide-react"

interface Camera {
  id: string
  name: string
  classId: string
  location: string
  ipAddress: string
  status: "active" | "inactive" | "offline"
  installDate: string
  model: string
}

interface CameraClass {
  classId: string
  className: string
  cameras: Camera[]
}

export function CameraManagement() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newCamera, setNewCamera] = useState({
    name: "",
    classId: "",
    location: "",
    ipAddress: "",
    model: "HD Camera",
  })

  // Load data
  useEffect(() => {
    const storedCameras = localStorage.getItem("camerasData")
    const adminData = localStorage.getItem("adminData")

    if (storedCameras) {
      try {
        setCameras(JSON.parse(storedCameras))
      } catch (e) {
        console.error("[v0] Failed to load cameras:", e)
      }
    }

    if (adminData) {
      try {
        const data = JSON.parse(adminData)
        setClasses(data.classes || [])
      } catch (e) {
        console.error("[v0] Failed to load classes:", e)
      }
    }
  }, [])

  const saveCameras = (updatedCameras: Camera[]) => {
    setCameras(updatedCameras)
    localStorage.setItem("camerasData", JSON.stringify(updatedCameras))
  }

  const addCamera = () => {
    if (!newCamera.name || !newCamera.classId) {
      alert("Please fill in camera name and select a class")
      return
    }

    const camera: Camera = {
      id: `CAM-${Date.now()}`,
      name: newCamera.name,
      classId: newCamera.classId,
      location: newCamera.location,
      ipAddress: newCamera.ipAddress || `192.168.1.${Math.floor(Math.random() * 255)}`,
      status: "active",
      installDate: new Date().toISOString().split("T")[0],
      model: newCamera.model,
    }

    saveCameras([...cameras, camera])
    setNewCamera({ name: "", classId: "", location: "", ipAddress: "", model: "HD Camera" })
  }

  const deleteCamera = (id: string) => {
    if (confirm("Are you sure you want to remove this camera?")) {
      saveCameras(cameras.filter((c) => c.id !== id))
    }
  }

  const toggleCameraStatus = (id: string) => {
    const updated: Camera[] = cameras.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          status: (c.status === "active" ? "inactive" : "active") satisfies Camera["status"],
        }
      }
      return c
    })
    saveCameras(updated)
  }

  const getClassroomCameras = (): CameraClass[] => {
    return classes.map((cls) => ({
      classId: cls.id,
      className: cls.name,
      cameras: cameras.filter((c) => c.classId === cls.id),
    }))
  }

  return (
    <div className="space-y-6">
      {/* Add New Camera */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Install New Camera</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            placeholder="Camera Name (e.g., Front Door, Class A)"
            value={newCamera.name}
            onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
          />
          <select
            className="px-4 py-2 rounded-lg border border-border bg-background text-foreground"
            value={newCamera.classId}
            onChange={(e) => setNewCamera({ ...newCamera, classId: e.target.value })}
          >
            <option value="">Select Class</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Location (e.g., Entrance, Back Corner)"
            value={newCamera.location}
            onChange={(e) => setNewCamera({ ...newCamera, location: e.target.value })}
          />
          <Input
            placeholder="IP Address (auto-generated if empty)"
            value={newCamera.ipAddress}
            onChange={(e) => setNewCamera({ ...newCamera, ipAddress: e.target.value })}
          />
          <select
            className="px-4 py-2 rounded-lg border border-border bg-background text-foreground"
            value={newCamera.model}
            onChange={(e) => setNewCamera({ ...newCamera, model: e.target.value })}
          >
            <option>HD Camera</option>
            <option>4K Camera</option>
            <option>Thermal Camera</option>
            <option>PTZ Camera</option>
          </select>
          <Button onClick={addCamera} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Install Camera
          </Button>
        </div>
      </Card>

      {/* Cameras by Classroom */}
      <div className="space-y-4">
        {getClassroomCameras().map((classroom) => (
          <Card key={classroom.classId} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {classroom.className}
              </h3>
              <Badge className="bg-primary/20 text-primary">
                {classroom.cameras.length} Camera{classroom.cameras.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {classroom.cameras.length === 0 ? (
              <div className="p-4 text-center bg-background/50 rounded-lg border border-dashed border-border">
                <Camera className="w-8 h-8 text-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-foreground/60">No cameras installed in this classroom</p>
              </div>
            ) : (
              <div className="space-y-3">
                {classroom.cameras.map((camera) => (
                  <div
                    key={camera.id}
                    className="flex items-start justify-between p-4 bg-background rounded-lg border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Video className="w-4 h-4 text-primary" />
                        <p className="font-semibold text-foreground">{camera.name}</p>
                        <Badge
                          className={`${
                            camera.status === "active"
                              ? "bg-green-500/20 text-green-700"
                              : "bg-yellow-500/20 text-yellow-700"
                          }`}
                        >
                          {camera.status === "active" ? (
                            <CheckCircle className="w-3 h-3 mr-1 inline" />
                          ) : (
                            <AlertCircle className="w-3 h-3 mr-1 inline" />
                          )}
                          {camera.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-foreground/60">
                        <p>Location: {camera.location}</p>
                        <p>IP: {camera.ipAddress}</p>
                        <p>Model: {camera.model}</p>
                        <p>Installed: {camera.installDate}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCameraStatus(camera.id)}
                      >
                        {camera.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteCamera(camera.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}

        {cameras.length === 0 && (
          <Card className="p-12 text-center">
            <Video className="w-12 h-12 text-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">No Cameras Installed</p>
            <p className="text-foreground/60">
              Install your first camera above to enable facial recognition attendance
            </p>
          </Card>
        )}
      </div>

      {/* Camera Statistics */}
      {cameras.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Camera Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-primary/10 rounded-lg text-center">
              <p className="text-3xl font-bold text-primary">{cameras.length}</p>
              <p className="text-sm text-foreground/60 mt-2">Total Cameras</p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg text-center">
              <p className="text-3xl font-bold text-green-700">
                {cameras.filter((c) => c.status === "active").length}
              </p>
              <p className="text-sm text-foreground/60 mt-2">Active</p>
            </div>
            <div className="p-4 bg-yellow-500/10 rounded-lg text-center">
              <p className="text-3xl font-bold text-yellow-700">
                {cameras.filter((c) => c.status === "inactive").length}
              </p>
              <p className="text-sm text-foreground/60 mt-2">Inactive</p>
            </div>
            <div className="p-4 bg-primary/5 rounded-lg text-center">
              <p className="text-3xl font-bold text-primary">
                {new Set(cameras.map((c) => c.classId)).size}
              </p>
              <p className="text-sm text-foreground/60 mt-2">Classes Covered</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
