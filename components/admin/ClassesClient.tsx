"use client"
import { useState } from "react"
import { Plus, ChevronDown, ChevronUp, Copy, Check, RefreshCw, Music2, Users, X, Wifi, WifiOff } from "lucide-react"

interface License {
  id: string
  seat_number: number
  code: string
  label: string | null
  session_token: string | null
  last_active_at: string | null
}

interface ClassSong {
  id: string
  song_id: string
  songs: { id: string; title: string; voicing: string } | null
}

interface Class {
  id: string
  name: string
  class_code: string
  student_count: number
  created_at: string
  licenses: License[]
  class_songs: ClassSong[]
}

interface Song {
  id: string
  title: string
  voicing: string
}

interface Props {
  classes: Class[]
  allSongs: Song[]
  teacherCode: string | null
}

export default function ClassesClient({ classes: initial, allSongs, teacherCode }: Props) {
  const [classes, setClasses] = useState<Class[]>(initial)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCount, setNewCount] = useState(30)
  const [saving, setSaving] = useState(false)
  const [editingCount, setEditingCount] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)

  function toggle(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }

  async function createClass() {
    if (!newName.trim()) return
    setSaving(true)
    const res = await fetch("/api/admin/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), student_count: newCount }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.class) {
      const cls = { ...data.class, licenses: [], class_songs: [] }
      setClasses((prev) => [...prev, cls])
      setExpanded((e) => ({ ...e, [cls.id]: true }))
      setCreating(false)
      setNewName("")
      setNewCount(30)
      // Refresh to get licenses
      window.location.reload()
    }
  }

  async function updateCount(cls: Class) {
    const raw = editingCount[cls.id]
    if (!raw) return
    const count = Math.max(1, Math.min(500, parseInt(raw) || 1))
    const res = await fetch("/api/admin/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cls.id, student_count: count }),
    })
    const data = await res.json()
    if (data.class) {
      setClasses((prev) => prev.map((c) => c.id === cls.id ? { ...c, student_count: data.class.student_count } : c))
      setEditingCount((e) => { const n = { ...e }; delete n[cls.id]; return n })
      window.location.reload()
    }
  }

  async function deleteClass(id: string) {
    if (!confirm("Delete this class and all its seat codes?")) return
    await fetch("/api/admin/classes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setClasses((prev) => prev.filter((c) => c.id !== id))
  }

  async function assignSong(classId: string, songId: string) {
    const res = await fetch("/api/admin/class-songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId, song_id: songId }),
    })
    const data = await res.json()
    if (data.class_song) {
      const song = allSongs.find((s) => s.id === songId)
      setClasses((prev) => prev.map((c) =>
        c.id === classId
          ? { ...c, class_songs: [...c.class_songs, { ...data.class_song, songs: song ? { id: song.id, title: song.title, voicing: song.voicing } : null }] }
          : c
      ))
    }
  }

  async function removeSong(classId: string, songId: string) {
    await fetch("/api/admin/class-songs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId, song_id: songId }),
    })
    setClasses((prev) => prev.map((c) =>
      c.id === classId
        ? { ...c, class_songs: c.class_songs.filter((cs) => cs.song_id !== songId) }
        : c
    ))
  }

  async function resetLicense(classId: string, licenseId: string) {
    await fetch("/api/admin/licenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: licenseId, reset: true }),
    })
    setClasses((prev) => prev.map((c) =>
      c.id === classId
        ? { ...c, licenses: c.licenses.map((l) => l.id === licenseId ? { ...l, session_token: null, last_active_at: null } : l) }
        : c
    ))
  }

  function copyAllCodes(cls: Class) {
    const text = cls.licenses
      .sort((a, b) => a.seat_number - b.seat_number)
      .map((l) => l.code + (l.label ? `  (${l.label})` : ""))
      .join("\n")
    navigator.clipboard.writeText(text)
    setCopied(cls.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Classes</h1>
          {teacherCode && (
            <p className="text-zinc-500 text-sm mt-0.5 font-mono">Teacher code: {teacherCode}</p>
          )}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus size={15} /> New Class
        </button>
      </div>

      {/* New class form */}
      {creating && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-zinc-100">Create New Class</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Class name</label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createClass()}
                placeholder="e.g. Concert Choir"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Student count</label>
              <input
                type="number"
                min={1}
                max={500}
                value={newCount}
                onChange={(e) => setNewCount(parseInt(e.target.value) || 1)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={createClass}
              disabled={saving || !newName.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {saving ? "Creating…" : `Create class · ${newCount} seat codes`}
            </button>
            <button onClick={() => setCreating(false)} className="text-sm text-zinc-400 hover:text-zinc-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {classes.length === 0 && !creating && (
        <div className="text-center py-16 text-zinc-500">
          No classes yet. Create one to get started.
        </div>
      )}

      {classes.map((cls) => {
        const isOpen = !!expanded[cls.id]
        const active = cls.licenses.filter((l) => l.session_token).length
        const assignedIds = new Set(cls.class_songs.map((cs) => cs.song_id))
        const unassigned = allSongs.filter((s) => !assignedIds.has(s.id))

        return (
          <div key={cls.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-4">
              <button onClick={() => toggle(cls.id)} className="flex-1 flex items-center gap-3 text-left">
                {isOpen ? <ChevronUp size={16} className="text-zinc-400 shrink-0" /> : <ChevronDown size={16} className="text-zinc-400 shrink-0" />}
                <div>
                  <p className="font-semibold text-zinc-100">{cls.name}</p>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    {teacherCode}-{cls.class_code}-### · {cls.student_count} seats · {active} active · {cls.class_songs.length} song{cls.class_songs.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </button>
              <button
                onClick={() => copyAllCodes(cls)}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition-colors shrink-0"
              >
                {copied === cls.id ? <><Check size={13} className="text-emerald-400" /> Copied</> : <><Copy size={13} /> Copy codes</>}
              </button>
              <button onClick={() => deleteClass(cls.id)} className="text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                <X size={15} />
              </button>
            </div>

            {isOpen && (
              <div className="border-t border-zinc-800 divide-y divide-zinc-800">
                {/* Songs section */}
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <Music2 size={14} /> Songs assigned
                    </h3>
                    {unassigned.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) { assignSong(cls.id, e.target.value); e.target.value = "" } }}
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-amber-400"
                      >
                        <option value="">+ Assign song…</option>
                        {unassigned.map((s) => (
                          <option key={s.id} value={s.id}>{s.title} ({s.voicing})</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {cls.class_songs.length === 0 ? (
                    <p className="text-xs text-zinc-600">No songs assigned yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {cls.class_songs.map((cs) => (
                        <div key={cs.id} className="flex items-center gap-1.5 bg-zinc-800 rounded-full px-3 py-1 text-xs text-zinc-300">
                          {cs.songs?.title ?? "Unknown"} · {cs.songs?.voicing}
                          <button onClick={() => removeSong(cls.id, cs.song_id)} className="text-zinc-500 hover:text-red-400 ml-1">
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Student count editor */}
                <div className="px-5 py-3 flex items-center gap-3">
                  <Users size={14} className="text-zinc-400 shrink-0" />
                  <span className="text-sm text-zinc-400">Student count:</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={editingCount[cls.id] ?? cls.student_count}
                    onChange={(e) => setEditingCount((ec) => ({ ...ec, [cls.id]: e.target.value }))}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-sm text-center focus:outline-none focus:border-amber-400"
                  />
                  {editingCount[cls.id] && (
                    <button
                      onClick={() => updateCount(cls)}
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Update seats
                    </button>
                  )}
                </div>

                {/* Seat codes */}
                <div className="px-5 py-4 space-y-1 max-h-64 overflow-y-auto">
                  {cls.licenses
                    .sort((a, b) => a.seat_number - b.seat_number)
                    .map((l) => (
                      <div key={l.id} className="flex items-center gap-3 text-xs">
                        {l.session_token
                          ? <Wifi size={11} className="text-emerald-400 shrink-0" />
                          : <WifiOff size={11} className="text-zinc-600 shrink-0" />}
                        <span className="font-mono text-zinc-300 w-36 shrink-0">{l.code}</span>
                        <span className="text-zinc-600 flex-1">{l.label ?? ""}</span>
                        <span className="text-zinc-600">{l.last_active_at ? formatRelative(l.last_active_at) : ""}</span>
                        {l.session_token && (
                          <button onClick={() => resetLicense(cls.id, l.id)} className="text-zinc-600 hover:text-amber-400 transition-colors">
                            <RefreshCw size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
