import { createClient } from "@/lib/supabase/server"
import ClassesClient from "@/components/admin/ClassesClient"

export default async function ClassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: classes }, { data: songs }, { data: profile }] = await Promise.all([
    supabase
      .from("classes")
      .select(`
        id, name, class_code, student_count, created_at,
        licenses(id, seat_number, code, label, session_token, last_active_at),
        class_songs(id, song_id, songs(id, title, voicing))
      `)
      .eq("teacher_id", user!.id)
      .order("created_at"),
    supabase.from("songs").select("id, title, voicing").eq("published", true).order("title"),
    supabase.from("teacher_profiles").select("teacher_code").eq("id", user!.id).single(),
  ])

  return (
    <ClassesClient
      classes={(classes ?? []) as any}
      allSongs={(songs ?? []) as any}
      teacherCode={profile?.teacher_code ?? null}
    />
  )
}
