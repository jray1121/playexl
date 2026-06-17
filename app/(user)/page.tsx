import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Lock, Music } from "lucide-react"

export default async function LibraryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: songs } = await supabase
    .from("songs")
    .select("id, title, composer, arranger, voicing, is_acappella, price, parts")
    .eq("published", true)
    .order("title")

  // Fetch purchases for logged-in user
  let purchasedIds = new Set<string>()
  if (user) {
    const { data: purchases } = await supabase
      .from("purchases")
      .select("song_id")
      .eq("user_id", user.id)
    purchasedIds = new Set(purchases?.map((p) => p.song_id) ?? [])
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100">Song Library</h1>
        <p className="text-zinc-400 mt-2">
          {songs?.length ?? 0} songs available for practice
        </p>
      </div>

      {!songs?.length ? (
        <div className="flex flex-col items-center py-24 gap-3 text-zinc-500">
          <Music size={40} />
          <p className="text-lg">No songs published yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {songs.map((song) => {
            const owned = purchasedIds.has(song.id)
            return (
              <SongCard
                key={song.id}
                song={song}
                owned={owned}
                loggedIn={!!user}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function SongCard({
  song,
  owned,
  loggedIn,
}: {
  song: {
    id: string
    title: string
    composer: string
    arranger?: string
    voicing: string
    is_acappella: boolean
    price: number
    parts: { name: string; color: string }[]
  }
  owned: boolean
  loggedIn: boolean
}) {
  return (
    <div className={`bg-zinc-900 border rounded-xl overflow-hidden flex flex-col transition-colors ${
      owned ? "border-brand/30 hover:border-brand/60" : "border-zinc-800 hover:border-zinc-700"
    }`}>
      {/* Color bar from first part color */}
      <div
        className="h-1 w-full"
        style={{ background: song.parts?.[0]?.color ?? "#873995" }}
      />

      <div className="p-5 flex flex-col flex-1 gap-3">
        <div>
          <h2 className="font-semibold text-zinc-100 text-base leading-tight">{song.title}</h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            {song.composer}
            {song.arranger && <span className="text-zinc-500"> · arr. {song.arranger}</span>}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Tag>{song.voicing}</Tag>
          {song.is_acappella && <Tag>A cappella</Tag>}
          {song.parts?.slice(0, 4).map((p) => (
            <span
              key={p.name}
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: p.color + "20", color: p.color }}
            >
              {p.name.replace("_", " ")}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-zinc-100 font-semibold">
            ${(song.price / 100).toFixed(2)}
          </span>

          {owned ? (
            <Link
              href={`/songs/${song.id}`}
              className="bg-brand hover:bg-brand-light text-zinc-900 font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors"
            >
              Practice →
            </Link>
          ) : loggedIn ? (
            <button className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium px-4 py-1.5 rounded-lg text-sm transition-colors">
              <Lock size={13} /> Purchase
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium px-4 py-1.5 rounded-lg text-sm transition-colors"
            >
              <Lock size={13} /> Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400">
      {children}
    </span>
  )
}
