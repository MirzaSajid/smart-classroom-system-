import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import path from "node:path"

type PythonAttendanceState =
  | { status: "stopped" }
  | { status: "starting"; startedAt: string }
  | { status: "running"; pid: number; startedAt: string }
  | { status: "error"; error: string; startedAt?: string }

declare global {
  // eslint-disable-next-line no-var
  var __pythonAttendance:
    | {
        proc: ChildProcessWithoutNullStreams | null
        state: PythonAttendanceState
      }
    | undefined
}

function getStore() {
  if (!globalThis.__pythonAttendance) {
    globalThis.__pythonAttendance = { proc: null, state: { status: "stopped" } }
  }
  return globalThis.__pythonAttendance
}

function getScriptPath() {
  // repoRoot/Facial Attendance System/program.py
  return path.join(process.cwd(), "Facial Attendance System", "program.py")
}

async function killPid(pid: number) {
  if (process.platform === "win32") {
    // Force kill the tree so OpenCV window closes too.
    await new Promise<void>((resolve, reject) => {
      const p = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true })
      p.on("error", reject)
      p.on("exit", () => resolve())
    })
    return
  }
  process.kill(pid, "SIGTERM")
}

export function getPythonAttendanceState(): PythonAttendanceState {
  return getStore().state
}

export async function startPythonAttendance(meta?: { classId?: string; className?: string }) {
  const store = getStore()
  if (store.proc && store.state.status === "running") return store.state
  if (store.state.status === "starting") return store.state

  const startedAt = new Date().toISOString()
  store.state = { status: "starting", startedAt }

  const scriptPath = getScriptPath()
  const args: string[] = [scriptPath]
  if (meta?.classId) args.push("--class-id", meta.classId)
  if (meta?.className) args.push("--class-name", meta.className)

  const proc = spawn("python", args, {
    cwd: path.dirname(scriptPath),
    windowsHide: false,
  })

  store.proc = proc
  store.state = { status: "running", pid: proc.pid ?? -1, startedAt }

  proc.on("exit", (code, signal) => {
    const current = getStore()
    if (current.proc === proc) {
      current.proc = null
      current.state =
        code === 0
          ? { status: "stopped" }
          : { status: "error", error: `Python exited (code=${code}, signal=${signal ?? "none"})`, startedAt }
    }
  })

  proc.on("error", (err) => {
    const current = getStore()
    if (current.proc === proc) {
      current.proc = null
      current.state = { status: "error", error: err.message, startedAt }
    }
  })

  return store.state
}

export async function stopPythonAttendance() {
  const store = getStore()
  const pid = store.proc?.pid
  if (!pid) {
    store.proc = null
    store.state = { status: "stopped" }
    return store.state
  }

  try {
    await killPid(pid)
  } catch (e: any) {
    store.state = { status: "error", error: e?.message ?? "Failed to stop python process" }
    return store.state
  } finally {
    store.proc = null
  }

  store.state = { status: "stopped" }
  return store.state
}

