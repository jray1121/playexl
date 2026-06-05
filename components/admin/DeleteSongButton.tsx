"use client"
import { useState } from "react"
import { Trash2, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function DeleteSongButton({ songId, songTitle }: { songId: string; songTitle: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function deleteSong() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from("songs").delete().eq("id", songId)
    router.push("/admin/songs")
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3 bg-red-950/50 border border-red-800 rounded-lg px-4 py-2">
        <span className="text-red-300 text-sm">Delete "{songTitle}"?</span>
        <button
          onClick={deleteSong}
          disabled={loading}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-3 py-1 rounded transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : null}
          Delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-zinc-400 hover:text-zinc-100 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-2 text-zinc-500 hover:text-red-400 transition-colors text-sm"
    >
      <Trash2 size={15} /> Delete song
    </button>
  )
}
