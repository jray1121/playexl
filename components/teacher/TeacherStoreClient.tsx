"use client"
import { useState, useMemo } from "react"
import { Music, ShoppingCart, Check } from "lucide-react"
import { baseColorForVoicing } from "@/lib/voicingColors"

type Song = {
  id: string
  title: string
  composer: string | null
  arranger: string | null
  voicing: string | null
  sku: string | null
  price: number | null
}

type Class = {
  id: string
  name: string
  student_count: number
}

export default function TeacherStoreClient({ songs, classes }: { songs: Song[]; classes: Class[] }) {
  const [selectedClass, setSelectedClass] = useState<string>("")
  const [assigning, setAssigning] = useState<string | null>(null)
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [activeVoicing, setActiveVoicing] = useState<string>("All")

  const voicings = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const s of songs) {
      const v = s.voicing ?? "Other"
      if (!seen.has(v)) { seen.add(v); list.push(v) }
    }
    return list
  }, [songs])

  const filtered = activeVoicing === "All"
    ? songs
    : songs.filter((s) => (s.voicing ?? "Other") === activeVoicing)

  async function assignSong(songId: string) {
    if (!selectedClass) {
      setError("Please select a class first")
      return
    }
    setAssigning(songId)
    setError(null)
    const res = await fetch("/api/admin/class-songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: selectedClass, song_id: songId }),
    })
    if (res.ok) {
      setAssigned((prev) => new Set([...prev, `${selectedClass}:${songId}`]))
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Failed to assign song")
    }
    setAssigning(null)
  }

  const selectedClassData = classes.find((c) => c.id === selectedClass)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Song Store</h1>
        <p className="text-zinc-400 text-sm mt-1">Assign songs to your classes so students can practice.</p>
      </div>

      {classes.length === 0 ? (
        <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-8 text-center">
          <Music size={28} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-300 font-medium">No classes yet</p>
          <p className="text-zinc-500 text-sm mt-1">
            <a href="/teacher/classes" className="text-brand hover:underline">Create a class</a> before assigning songs.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
          <label className="text-sm font-medium text-zinc-300 shrink-0">Assign songs to:</label>
          <select
            value={selectedClass}
            onChange={(e) => { setSelectedClass(e.target.value); setError(null) }}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-brand"
          >
            <option value="">Select a class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.student_count} students)</option>
            ))}
          </select>
          {selectedClassData && (
            <span className="text-xs text-zinc-500 shrink-0">
              {selectedClassData.student_count} seat{selectedClassData.student_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {songs.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400">No songs available yet.</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Voicing sidebar */}
          <div className="w-44 shrink-0">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {["All", ...voicings].map((v) => {
                const color = v === "All" ? null : baseColorForVoicing(v)
                const isActive = activeVoicing === v
                return (
                  <button
                    key={v}
                    onClick={() => setActiveVoicing(v)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors border-b border-zinc-800 last:border-0"
                    style={isActive && color
                      ? { background: `${color}22`, color: color }
                      : isActive
                      ? { background: "rgba(135,57,149,0.13)", color: "#873995" }
                      : {}}
                  >
                    {color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: isActive ? color : `${color}88` }}
                      />
                    )}
                    <span className={isActive ? "font-semibold" : "text-zinc-400 hover:text-zinc-200"}>
                      {v}
                    </span>
                    <span className="ml-auto text-xs text-zinc-600">
                      {v === "All" ? songs.length : songs.filter((s) => (s.voicing ?? "Other") === v).length}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Song list */}
          <div className="flex-1 grid gap-3 content-start">
            {filtered.map((song) => {
              const key = `${selectedClass}:${song.id}`
              const isAssigned = assigned.has(key)
              const isAssigning = assigning === song.id
              const color = baseColorForVoicing(song.voicing ?? "")
              return (
                <div key={song.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-100 truncate">{song.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {[song.composer, song.arranger && `arr. ${song.arranger}`, song.voicing]
                        .filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {song.price != null && (
                    <span className="text-sm text-zinc-400 shrink-0">
                      ${(song.price / 100).toFixed(2)}<span className="text-zinc-600">/seat</span>
                    </span>
                  )}
                  <button
                    onClick={() => assignSong(song.id)}
                    disabled={isAssigning || isAssigned || classes.length === 0}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand hover:bg-brand-light text-zinc-900"
                  >
                    {isAssigned ? (
                      <><Check size={14} /> Assigned</>
                    ) : isAssigning ? (
                      "Assigning…"
                    ) : (
                      <><ShoppingCart size={14} /> Assign to class</>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
