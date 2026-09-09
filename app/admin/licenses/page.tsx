import { createClient } from "@/lib/supabase/server"
import LicensesClient from "@/components/admin/LicensesClient"

export default async function LicensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: licenses } = await supabase
    .from("licenses")
    .select("id, code, label, seat_number, session_token, activated_at, last_active_at, created_at, song_id, songs(title, voicing)")
    .eq("teacher_id", user!.id)
    .order("song_id")
    .order("seat_number")

  const { data: profile } = await supabase
    .from("teacher_profiles")
    .select("teacher_code")
    .eq("id", user!.id)
    .single()

  return <LicensesClient licenses={(licenses ?? []) as any} teacherCode={profile?.teacher_code ?? null} />
}
