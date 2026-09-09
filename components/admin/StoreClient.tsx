"use client"
import { useState } from "react"
import { ShoppingCart, Music2, Check, AlertCircle } from "lucide-react"

interface Song {
  id: string
  title: string
  composer: string
  voicing: string
  sku: string | null
}

interface Props {
  songs: Song[]
}

export default function StoreClient({ songs }: Props) {
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [quantity, setQuantity] = useState<Record<string, number>>({})
  const [result, setResult] = useState<{ songId: string; codes: string[]; error?: string } | null>(null)

  async function purchase(song: Song) {
    const qty = quantity[song.id] ?? 1
    setPurchasing(song.id)
    setResult(null)

    const res = await fetch("/api/admin/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_id: song.id, quantity: qty }),
    })
    const data = await res.json()
    setPurchasing(null)

    if (!res.ok) {
      setResult({ songId: song.id, codes: [], error: data.error })
      return
    }

    setResult({
      songId: song.id,
      codes: data.licenses.map((l: { code: string }) => l.code),
    })
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Song Store</h1>
        <p className="text-zinc-400 text-sm mt-1">Purchase student licenses for published songs.</p>
      </div>

      {songs.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">No published songs yet.</div>
      ) : (
        <div className="space-y-4">
          {songs.map((song) => (
            <div key={song.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Music2 size={18} className="text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-zinc-100">{song.title}</p>
                    <p className="text-sm text-zinc-400">{song.composer} · {song.voicing}</p>
                  </div>
                </div>
                {song.sku ? (
                  <span className="font-mono text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded shrink-0">
                    {song.sku}
                  </span>
                ) : (
                  <span className="text-xs text-amber-500 shrink-0">No song code — edit song first</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-zinc-400">Seats:</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={quantity[song.id] ?? 1}
                  onChange={(e) =>
                    setQuantity((q) => ({ ...q, [song.id]: Math.max(1, Math.min(200, parseInt(e.target.value) || 1)) }))
                  }
                  className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-sm text-center focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => purchase(song)}
                  disabled={!song.sku || purchasing === song.id}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <ShoppingCart size={14} />
                  {purchasing === song.id ? "Generating…" : `Purchase ${quantity[song.id] ?? 1} License${(quantity[song.id] ?? 1) > 1 ? "s" : ""}`}
                </button>
              </div>

              {result?.songId === song.id && (
                <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: result.error ? "#ef4444" : "#22c55e" }}>
                  {result.error ? (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle size={15} /> {result.error}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                        <Check size={15} /> {result.codes.length} license{result.codes.length > 1 ? "s" : ""} generated
                      </div>
                      <div className="font-mono text-xs text-zinc-300 bg-zinc-950 rounded p-3 max-h-40 overflow-y-auto space-y-1">
                        {result.codes.map((c) => <div key={c}>{c}</div>)}
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(result.codes.join("\n"))}
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        Copy all codes
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
