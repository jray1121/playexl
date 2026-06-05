import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Plus, Eye, EyeOff, Music } from "lucide-react"

export default async function SongsPage() {
  const supabase = await createClient()
  const { data: songs } = await supabase
    .from("songs")
    .select("id, title, composer, voicing, published, price, created_at, parts, beat_map")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Songs</h1>
          <p className="text-zinc-400 text-sm mt-1">{songs?.length ?? 0} songs in your library</p>
        </div>
        <Link
          href="/admin/songs/new"
          className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus size={16} /> New Song
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {!songs?.length ? (
          <div className="flex flex-col items-center py-20 gap-3 text-zinc-500">
            <Music size={36} />
            <p className="text-lg">No songs yet</p>
            <Link href="/admin/songs/new" className="text-amber-400 hover:underline text-sm">
              Add your first song
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 text-left border-b border-zinc-800 bg-zinc-800/30">
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Composer</th>
                <th className="px-5 py-3 font-medium">Voicing</th>
                <th className="px-5 py-3 font-medium">Parts</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Beat Map</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr key={song.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-zinc-100">{song.title}</td>
                  <td className="px-5 py-3 text-zinc-400">{song.composer}</td>
                  <td className="px-5 py-3 text-zinc-400">{song.voicing}</td>
                  <td className="px-5 py-3 text-zinc-400">{song.parts?.length ?? 0}</td>
                  <td className="px-5 py-3 text-zinc-400">${(song.price / 100).toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs ${song.beat_map ? "text-green-400" : "text-zinc-600"}`}>
                      {song.beat_map ? "✓ Ready" : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      song.published
                        ? "bg-green-400/10 text-green-400"
                        : "bg-zinc-700 text-zinc-400"
                    }`}>
                      {song.published ? <Eye size={11} /> : <EyeOff size={11} />}
                      {song.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/songs/${song.id}`} className="text-amber-400 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
