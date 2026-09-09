import { createClient } from "@/lib/supabase/server"
import TeacherStoreClient from "@/components/teacher/TeacherStoreClient"

export default async function TeacherStorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: songs }, { data: classes }] = await Promise.all([
    supabase.from("songs").select("id, title, composer, arranger, voicing, sku, price").eq("published", true).order("title"),
    supabase.from("classes").select("id, name, student_count").eq("teacher_id", user!.id).order("name"),
  ])

  return <TeacherStoreClient songs={songs ?? []} classes={classes ?? []} />
}
