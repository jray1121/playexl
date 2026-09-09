import { createClient as createServiceClient } from "@supabase/supabase-js"

type LicenseRow = { session_token: string | null }
type ClassRow = {
  id: string
  name: string
  student_count: number
  licenses: LicenseRow[]
  class_songs: { id: string }[]
}
type TeacherRow = {
  id: string
  email: string
  name: string | null
  school: string | null
  created_at: string
  classes: ClassRow[]
}

export default async function AdminTeachersPage() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get all users with role=teacher from auth.users via service role
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const teacherUsers = (authUsers?.users ?? []).filter(
    (u) => u.user_metadata?.role === "teacher"
  )
  const teacherIds = teacherUsers.map((u) => u.id)

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, student_count, teacher_id, licenses(session_token), class_songs(id)")
    .in("teacher_id", teacherIds.length ? teacherIds : ["none"])

  // Group classes by teacher
  const classesByTeacher: Record<string, ClassRow[]> = {}
  for (const cls of classes ?? []) {
    if (!classesByTeacher[cls.teacher_id]) classesByTeacher[cls.teacher_id] = []
    classesByTeacher[cls.teacher_id].push(cls as ClassRow)
  }

  const teachers: TeacherRow[] = teacherUsers.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    name: (u.user_metadata?.name as string) ?? null,
    school: (u.user_metadata?.school as string) ?? null,
    created_at: u.created_at,
    classes: classesByTeacher[u.id] ?? [],
  }))

  // Summary totals
  const totalTeachers = teachers.length
  const totalSeats = teachers.reduce((sum, t) => sum + t.classes.reduce((s, c) => s + c.student_count, 0), 0)
  const totalActive = teachers.reduce(
    (sum, t) => sum + t.classes.reduce((s, c) => s + c.licenses.filter((l) => l.session_token).length, 0),
    0
  )
  const totalClasses = teachers.reduce((sum, t) => sum + t.classes.length, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Teachers</h1>
        <p className="text-zinc-400 text-sm mt-1">All registered teacher accounts and their licensing activity.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Teachers", value: totalTeachers },
          { label: "Classes", value: totalClasses },
          { label: "Total Seats", value: totalSeats },
          { label: "Active Students", value: totalActive },
        ].map(({ label, value }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-sm">{label}</p>
            <p className="text-3xl font-bold text-zinc-100 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {teachers.length === 0 ? (
          <div className="py-16 text-center text-zinc-500">No teachers have signed up yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 text-left border-b border-zinc-800">
                <th className="px-5 py-3 font-medium">Teacher</th>
                <th className="px-5 py-3 font-medium">School</th>
                <th className="px-5 py-3 font-medium text-right">Classes</th>
                <th className="px-5 py-3 font-medium text-right">Seats</th>
                <th className="px-5 py-3 font-medium text-right">Active</th>
                <th className="px-5 py-3 font-medium text-right">Songs</th>
                <th className="px-5 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => {
                const seats = t.classes.reduce((s, c) => s + c.student_count, 0)
                const active = t.classes.reduce((s, c) => s + c.licenses.filter((l) => l.session_token).length, 0)
                const songCount = new Set(t.classes.flatMap((c) => c.class_songs.map((cs) => cs.id))).size
                return (
                  <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-zinc-100">{t.name ?? t.email}</p>
                      <p className="text-xs text-zinc-500">{t.name ? t.email : ""}</p>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">{t.school ?? "—"}</td>
                    <td className="px-5 py-3 text-zinc-300 text-right">{t.classes.length}</td>
                    <td className="px-5 py-3 text-zinc-300 text-right">{seats}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={active > 0 ? "text-green-400" : "text-zinc-500"}>
                        {active}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-300 text-right">{songCount}</td>
                    <td className="px-5 py-3 text-zinc-500 text-xs">
                      {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Per-teacher class breakdown */}
      {teachers.filter((t) => t.classes.length > 0).map((t) => (
        <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800">
            <p className="font-semibold text-zinc-100">{t.name ?? t.email}</p>
            {t.school && <p className="text-xs text-zinc-500">{t.school}</p>}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 text-left border-b border-zinc-800">
                <th className="px-5 py-3 font-medium">Class</th>
                <th className="px-5 py-3 font-medium text-right">Seats</th>
                <th className="px-5 py-3 font-medium text-right">Active</th>
                <th className="px-5 py-3 font-medium text-right">Songs assigned</th>
              </tr>
            </thead>
            <tbody>
              {t.classes.map((cls) => {
                const active = cls.licenses.filter((l) => l.session_token).length
                return (
                  <tr key={cls.id} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-5 py-3 text-zinc-200">{cls.name}</td>
                    <td className="px-5 py-3 text-zinc-400 text-right">{cls.student_count}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={active > 0 ? "text-green-400" : "text-zinc-500"}>{active}</span>
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-right">{cls.class_songs.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
