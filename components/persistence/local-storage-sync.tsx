"use client"

import { useEffect } from "react"

const MANAGED_KEYS = new Set([
  "adminData",
  "camerasData",
  "attendanceRecords",
  "studentDataset",
  "gradesData",
  "behaviorAlerts",
  "announcements",
  "feeInvoices",
  "currentClass",
  "currentUser",
  "loginTime",
])

type SyncPayload = {
  upserts: Array<{ key: string; value: string }>
  deletes: string[]
}

export function LocalStorageSync() {
  useEffect(() => {
    let active = true
    let hydrating = true
    let timer: number | null = null
    const queue: SyncPayload = { upserts: [], deletes: [] }

    const scheduleFlush = () => {
      if (timer != null) return
      timer = window.setTimeout(async () => {
        timer = null
        if (!active) return
        if (queue.upserts.length === 0 && queue.deletes.length === 0) return

        const payload: SyncPayload = {
          upserts: [...queue.upserts],
          deletes: [...queue.deletes],
        }
        queue.upserts = []
        queue.deletes = []

        try {
          await fetch("/api/state", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        } catch {
          // best effort sync
        }
      }, 400)
    }

    const enqueueUpsert = (key: string, value: string) => {
      queue.deletes = queue.deletes.filter((k) => k !== key)
      queue.upserts = queue.upserts.filter((entry) => entry.key !== key)
      queue.upserts.push({ key, value })
      scheduleFlush()
    }

    const enqueueDelete = (key: string) => {
      queue.upserts = queue.upserts.filter((entry) => entry.key !== key)
      if (!queue.deletes.includes(key)) queue.deletes.push(key)
      scheduleFlush()
    }

    const originalSetItem = window.localStorage.setItem.bind(window.localStorage)
    const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage)
    const originalClear = window.localStorage.clear.bind(window.localStorage)

    const setItemPatched: Storage["setItem"] = (key, value) => {
      originalSetItem(key, value)
      if (!hydrating && MANAGED_KEYS.has(key)) {
        enqueueUpsert(key, value)
      }
    }
    const removeItemPatched: Storage["removeItem"] = (key) => {
      originalRemoveItem(key)
      if (!hydrating && MANAGED_KEYS.has(key)) {
        enqueueDelete(key)
      }
    }
    const clearPatched: Storage["clear"] = () => {
      originalClear()
      if (!hydrating) {
        for (const key of MANAGED_KEYS) {
          enqueueDelete(key)
        }
      }
    }

    window.localStorage.setItem = setItemPatched
    window.localStorage.removeItem = removeItemPatched
    window.localStorage.clear = clearPatched

    const hydrate = async () => {
      try {
        const res = await fetch("/api/state")
        const json = (await res.json()) as { ok?: boolean; data?: Record<string, string> }
        if (!active || !res.ok || !json.ok || !json.data) return

        for (const key of MANAGED_KEYS) {
          const value = json.data[key]
          if (typeof value === "string") {
            originalSetItem(key, value)
          }
        }
      } catch {
        // ignore if offline
      } finally {
        hydrating = false
      }
    }

    void hydrate()

    return () => {
      active = false
      hydrating = false
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
      window.localStorage.setItem = originalSetItem
      window.localStorage.removeItem = originalRemoveItem
      window.localStorage.clear = originalClear
    }
  }, [])

  return null
}
