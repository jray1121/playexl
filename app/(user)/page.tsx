import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Music } from "lucide-react"
import LibrarySection from "@/components/user/LibrarySection"
import SongCard from "@/components/user/SongCard"
import { VOICING_CATEGORIES, categoryFor } from "@/lib/voicingCategories"

export default async function LibraryPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const { data: { user } } = await supabase.auth.getUser()
  const studentClassId = cookieStore.get("student_class_id")?.value ?? null

  let songs: { id: string; title: string; composer: string; arranger: string | null; voicing: string; is_acappella: boolean; price: number; parts: unknown[] }[] = []

  // Student cookie takes priority — if present, always show only their assigned songs
  // even if a teacher Supabase session is also active in the browser
  if (studentClassId) {
    // Student: fetch song IDs for this class, then load those songs
    const { data: classSongs } = await supabase
      .from("class_songs")
      .select("song_id")
      .eq("class_id", studentClassId)
    const songIds = classSongs?.map((cs) => cs.song_id) ?? []
    if (songIds.length > 0) {
      const { data } = await supabase
        .from("songs")
        .select("id, title, composer, arranger, voicing, is_acappella, price, parts")
        .in("id", songIds)
        .eq("published", true)
        .order("title")
      songs = data ?? []
    }
  } else if (user) {
    // Teacher/admin: sees all published songs
    const { data } = await supabase
      .from("songs")
      .select("id, title, composer, arranger, voicing, is_acappella, price, parts")
      .eq("published", true)
      .order("title")
    songs = data ?? []
  }

  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase())
  const isAdmin = !!user && ADMIN_EMAILS.includes((user.email ?? "").toLowerCase())

  // For teachers: find which songs are assigned to any of their classes
  const assignedIds = new Set<string>()
  if (user && !isAdmin) {
    const { data: classSongs } = await supabase
      .from("class_songs")
      .select("song_id, classes!inner(teacher_id)")
      .eq("classes.teacher_id", user.id)
    classSongs?.forEach((cs) => assignedIds.add(cs.song_id))
  }

  const purchasedIds = new Set<string>()

  return (
    <div>
      <div className="border-b border-zinc-800 bg-zinc-900/60">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Song Library</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            {songs.length} {songs.length === 1 ? "song" : "songs"} available for practice
          </p>
        </div>
      </div>

      {!!songs.length && (
        <div className="sticky top-14 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-2 overflow-x-auto py-2.5">
            {VOICING_CATEGORIES.filter(({ label }) => songs.some((s) => categoryFor(s.voicing) === label)).map(({ label, id, colors }) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-zinc-400 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-1.5 rounded-full transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: `linear-gradient(135deg, ${colors.join(", ")})` }}
                />
                {label}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {!songs.length ? (
          <div className="flex flex-col items-center py-32 gap-4">
            <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Music size={28} className="text-zinc-500" />
            </div>
            <div className="text-center">
              <p className="text-zinc-300 font-medium">No songs available yet</p>
              <p className="text-zinc-500 text-sm mt-1">Your teacher hasn't assigned any songs to your class.</p>
            </div>
          </div>
        ) : (
          VOICING_CATEGORIES.filter(({ label }) => songs.some((s) => categoryFor(s.voicing) === label)).map(({ label, id, colors }) => {
            const sectionSongs = songs.filter((s) => categoryFor(s.voicing) === label)
            return (
              <LibrarySection key={label} id={id} label={label} count={sectionSongs.length} colors={colors}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {sectionSongs.map((song) => (
                    <SongCard
                      key={song.id}
                      song={{ ...song, arranger: song.arranger ?? undefined, parts: song.parts as { name: string; color: string }[] }}
                      owned={isAdmin || !!studentClassId || assignedIds.has(song.id) || purchasedIds.has(song.id)}
                      loggedIn={!!user || !!studentClassId}
                    />
                  ))}
                </div>
              </LibrarySection>
            )
          })
        )}
      </div>
    </div>
  )
}
