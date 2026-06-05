import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import Player from "@/components/player/Player"

export default async function SongPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: song } = await supabase
    .from("songs")
    .select("*")
    .eq("id", id)
    .eq("published", true)
    .single()

  if (!song) notFound()

  // Check ownership
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("user_id", user.id)
    .eq("song_id", id)
    .single()

  if (!purchase) redirect("/")

  return <Player song={song} />
}
