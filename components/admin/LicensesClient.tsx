"use client"
import { useState } from "react"
import { RefreshCw, Tag, Wifi, WifiOff, Copy, Check } from "lucide-react"

interface License {
  id: string
  code: string
  label: string | null
  seat_number: number
  session_token: string | null
  activated_at: string | null
  last_active_at: string | null
  created_at: string
  song_id: string
  songs: { title: string; voicing: string } | null
}

interface Props {
  licenses: License[]
  teacherCode: string | null
}

export default function LicensesClient({ licenses: initial, teacherCode }: Props) {
  const [licenses, setLicenses] = useState<License[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  // Group by song
  const bySong = licenses.reduce<Record<string, License[]>>((acc, l) => {
    if (!acc[l.song_id]) acc[l.song_id] = []
    acc[l.song_id].push(l)
    return acc
  }, {})

  const totalActive = licenses.filter((l) => l.session_token).length

  async function resetLicense(id: string) {
    await fetch("/api/admin/licenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reset: true }),
    })
    setLicenses((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, session_token: null, activated_at: null, last_active_at: null } : l
      )
    )
  }

  async function saveLabel(id: string) {
    await fetch("/api/admin/licenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, label: editLabel }),
    })
    setLicenses((prev) =>
      prev.map((l) => (l.id === id ? { ...l, label: editLabel || null } : l))
    )
    setEditingId(null)
  }

  async function deleteLicense(id: string) {
    await fetch("/api/admin/licenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setLicenses((prev) => prev.filter((l) => l.id !== id))
  }

  function copyAll(songLicenses: License[]) {
    const text = songLicenses.map((l) => l.code + (l.label ? `  (${l.label})` : "")).join("\n")
    navigator.clipboard.writeText(text)
    const key = songLicenses[0]?.song_id
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">My Licenses</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {licenses.length} total · {totalActive} active
            {teacherCode && <span className="ml-2 font-mono text-zinc-500">Teacher code: {teacherCode}</span>}
          </p>
        </div>
        <a
          href="/admin/store"
          className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Buy more licenses →
        </a>
      </div>

      {Object.keys(bySong).length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          No licenses yet.{" "}
          <a href="/admin/store" className="text-amber-400 hover:text-amber-300">
            Purchase licenses from the store.
          </a>
        </div>
      ) : (
        Object.entries(bySong).map(([songId, songLicenses]) => {
          const song = songLicenses[0]?.songs
          const active = songLicenses.filter((l) => l.session_token).length
          return (
            <div key={songId} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-zinc-100">{song?.title ?? "Unknown Song"}</h2>
                  <p className="text-xs text-zinc-500">{song?.voicing} · {songLicenses.length} seats · {active} active</p>
                </div>
                <button
                  onClick={() => copyAll(songLicenses)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition-colors"
                >
                  {copied === songId ? <><Check size={13} className="text-emerald-400" /> Copied</> : <><Copy size={13} /> Copy all codes</>}
                </button>
              </div>

              {songLicenses.map((license) => (
                <div
                  key={license.id}
                  className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5"
                >
                  <div className="shrink-0">
                    {license.session_token
                      ? <Wifi size={14} className="text-emerald-400" />
                      : <WifiOff size={14} className="text-zinc-600" />}
                  </div>

                  <span className="font-mono text-sm text-zinc-100 w-36 shrink-0">{license.code}</span>

                  <div className="flex-1">
                    {editingId === license.id ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveLabel(license.id)
                            if (e.key === "Escape") setEditingId(null)
                          }}
                          placeholder="e.g. Period 2 – Seat 4"
                          className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-400"
                        />
                        <button onClick={() => saveLabel(license.id)} className="text-xs text-amber-400 hover:text-amber-300 px-2">
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(license.id); setEditLabel(license.label ?? "") }}
                        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-100 transition-colors"
                      >
                        <Tag size={11} />
                        {license.label ?? <span className="italic text-zinc-600">Add label…</span>}
                      </button>
                    )}
                  </div>

                  <span className="text-xs text-zinc-600 w-24 text-right shrink-0">
                    {license.last_active_at ? formatRelative(license.last_active_at) : "Never used"}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => resetLicense(license.id)}
                      disabled={!license.session_token}
                      title="Reset session"
                      className="text-zinc-600 hover:text-amber-400 disabled:opacity-20 transition-colors"
                    >
                      <RefreshCw size={13} />
                    </button>
                    <button
                      onClick={() => deleteLicense(license.id)}
                      title="Delete"
                      className="text-zinc-600 hover:text-red-400 transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        })
      )}

      <p className="text-xs text-zinc-600">
        Each code is unique to one student and one song. Sharing a code kicks the previous session out.
        Use Reset to let a student back in after switching devices.
      </p>
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
