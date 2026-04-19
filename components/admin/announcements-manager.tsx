"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Trash2, Megaphone } from "lucide-react"

export type AnnouncementAudience = "students" | "teachers" | "all"
export type AnnouncementCategory = "general" | "exam" | "fees" | "urgent"

export type Announcement = {
  id: string
  title: string
  message: string
  audience: AnnouncementAudience
  category: AnnouncementCategory
  createdAt: string
}

const LS_KEY = "announcements"

function loadAnnouncements(): Announcement[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAnnouncements(list: Announcement[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}

export function AnnouncementsManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [audience, setAudience] = useState<AnnouncementAudience>("all")
  const [category, setCategory] = useState<AnnouncementCategory>("general")

  useEffect(() => {
    setAnnouncements(loadAnnouncements())
  }, [])

  const sorted = useMemo(() => {
    return [...announcements].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }, [announcements])

  const post = () => {
    const t = title.trim()
    const m = message.trim()
    if (!t || !m) return

    const next: Announcement = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: t,
      message: m,
      audience,
      category,
      createdAt: new Date().toISOString(),
    }
    const updated = [next, ...announcements].slice(0, 200)
    setAnnouncements(updated)
    saveAnnouncements(updated)
    setTitle("")
    setMessage("")
    setAudience("all")
    setCategory("general")
  }

  const remove = (id: string) => {
    const updated = announcements.filter((a) => a.id !== id)
    setAnnouncements(updated)
    saveAnnouncements(updated)
  }

  const categoryBadge = (c: AnnouncementCategory) => {
    if (c === "urgent") return <Badge variant="destructive">Urgent</Badge>
    if (c === "fees") return <Badge className="bg-primary/15 text-primary">Fees</Badge>
    if (c === "exam") return <Badge className="bg-accent/15 text-accent">Exam</Badge>
    return <Badge variant="outline" className="bg-transparent">General</Badge>
  }

  return (
    <div className="space-y-4">
      <Card variant="glass" className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Create announcement</p>
            </div>
            <p className="text-xs text-foreground/60">Post targeted updates for students or teachers.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
              className="h-9 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm"
            >
              <option value="all">All</option>
              <option value="students">Students</option>
              <option value="teachers">Teachers</option>
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
              className="h-9 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm"
            >
              <option value="general">General</option>
              <option value="exam">Exam</option>
              <option value="fees">Fees</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="bg-[var(--glass-bg)] border-[var(--glass-border)]"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your announcement…"
            className="min-h-28 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <div className="flex justify-end">
            <Button onClick={post} disabled={!title.trim() || !message.trim()} className="rounded-xl">
              Post announcement
            </Button>
          </div>
        </div>
      </Card>

      <Card variant="glass" className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Recent announcements</p>
          <Badge variant="outline" className="bg-transparent">
            {sorted.length}
          </Badge>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-foreground/60 mt-4">No announcements yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {sorted.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-4 hover:bg-[var(--glass-bg-strong)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{a.title}</p>
                      {categoryBadge(a.category)}
                      <Badge variant="outline" className="bg-transparent text-[10px] h-5">
                        {a.audience}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground/70 mt-1 whitespace-pre-wrap">{a.message}</p>
                    <p className="text-xs text-foreground/50 mt-2">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    onClick={() => remove(a.id)}
                    aria-label="Delete announcement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

