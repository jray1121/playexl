import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Users, Music, KeyRound } from "lucide-react"

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: classes }, { data: profile }] = await Promise.all([
    supabase.from("classes").select("id, name, student_count, class_songs(id), licenses(id, session_token)").eq("teacher_id", user!.id),
    supabase.from("teacher_profiles").select("teacher_code").eq("id", user!.id).single(),
  ])

  const totalSeats = classes?.reduce((sum, c) => sum + c.student_count, 0) ?? 0
  const activeSeats = classes?.reduce((sum, c) => sum + c.licenses.filter((l: { session_token: string | null }) => l.session_token).length, 0) ?? 0

  const name = (user?.user_metadata?.name as string) ?? user?.email ?? ""
  const school = (user?.user_metadata?.school as string) ?? ""

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Welcome{name ? `, ${name}` : ""}</h1>
        {school && <p className="text-zinc-400 text-sm mt-0.5">{school}</p>}
        {profile?.teacher_code && (
          <p className="text-zinc-500 text-xs mt-1 font-mono">Teacher code: {profile.teacher_code}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Classes</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">{classes?.length ?? 0}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Total seats</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">{totalSeats}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Active students</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">{activeSeats}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/teacher/classes" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-6 flex items-center gap-4 transition-colors group">
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Users size={20} className="text-brand" />
          </div>
          <div>
            <p className="font-semibold text-zinc-100">Manage Classes</p>
            <p className="text-xs text-zinc-500 mt-0.5">Create classes, assign songs, view student codes</p>
          </div>
        </Link>
        <Link href="/teacher/store" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-6 flex items-center gap-4 transition-colors group">
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Music size={20} className="text-brand" />
          </div>
          <div>
            <p className="font-semibold text-zinc-100">Song Store</p>
            <p className="text-xs text-zinc-500 mt-0.5">Browse and purchase licenses for your students</p>
          </div>
        </Link>
      </div>

      {(!classes || classes.length === 0) && (
        <div className="bg-zinc-900/50 border border-dashed border-zinc-700 rounded-xl p-8 text-center space-y-3">
          <KeyRound size={28} className="text-zinc-600 mx-auto" />
          <p className="text-zinc-300 font-medium">No classes yet</p>
          <p className="text-zinc-500 text-sm">Create your first class to generate student access codes.</p>
          <Link href="/teacher/classes" className="inline-block mt-2 bg-brand hover:bg-brand-light text-zinc-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
            Create a class
          </Link>
        </div>
      )}
    </div>
  )
}
