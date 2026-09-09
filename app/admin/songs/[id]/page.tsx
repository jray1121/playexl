import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import SongForm from "@/components/admin/SongForm"
import DeleteSongButton from "@/components/admin/DeleteSongButton"
import Link from "next/link"
import { MapPin, Play } from "lucide-react"

export default async function EditSongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: song } = await supabase.from("songs").select("*").eq("id", id).single()

  if (!song) notFound()

  const initialData = {
    id: song.id,
    title: song.title,
    composer: song.composer,
    lyricist: song.lyricist,
    arranger: song.arranger,
    voicing: song.voicing,
    isAcappella: song.is_acappella,
    price: song.price,
    published: song.published,
    parts: song.parts,
    timeSigMap: song.time_sig_map,
    sheetMusicUrl: song.sheet_music_url,
    clickTrackUrl: song.click_track_url,
    beatMap: song.beat_map,
    tempo: song.tempo,
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Edit Song</h1>
          <p className="text-zinc-400 text-sm mt-1">{song.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/songs/${song.id}`}
            target="_blank"
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Play size={15} /> Preview Player
          </Link>
          {song.sheet_music_url && (
            <Link
              href={`/admin/songs/${song.id}/map-measures`}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <MapPin size={15} /> Map Measures
            </Link>
          )}
          <DeleteSongButton songId={song.id} songTitle={song.title} />
        </div>
      </div>
      <SongForm initialData={initialData} />
    </div>
  )
}
