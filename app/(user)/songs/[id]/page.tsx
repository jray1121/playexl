import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Player from "@/components/player/Player"

export default async function SongPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const cookieStore = await cookies()

  const { data: { user } } = await supabase.auth.getUser()
  const studentClassId = cookieStore.get("student_class_id")?.value ?? null
  const studentToken = cookieStore.get("student_token")?.value ?? null

  // Must be a logged-in teacher or an active student session
  if (!user && !studentToken) redirect("/student")

  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase())
  const isAdmin = !!user && ADMIN_EMAILS.includes((user.email ?? "").toLowerCase())

  const { data: song } = await (isAdmin
    ? supabase.from("songs").select("*").eq("id", id).single()
    : supabase.from("songs").select("*").eq("id", id).eq("published", true).single())

  if (!song) notFound()

  if (isAdmin) {
    // Admin: always allowed
  } else if (user) {
    // Teacher: allowed if song is assigned to any of their classes
    const { data: classSong } = await supabase
      .from("class_songs")
      .select("id, classes!inner(teacher_id)")
      .eq("song_id", id)
      .eq("classes.teacher_id", user.id)
      .limit(1)
      .single()
    if (!classSong) redirect("/")
  } else if (studentClassId) {
    // Student: check song is assigned to their class
    const { data: classSong } = await supabase
      .from("class_songs")
      .select("id")
      .eq("class_id", studentClassId)
      .eq("song_id", id)
      .single()
    if (!classSong) redirect("/")
  }

  return <Player song={song} />
}
