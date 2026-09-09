import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
function randomSegment(n: number) {
  return Array.from({ length: n }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("")
}

async function getOrCreateTeacherCode(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("teacher_profiles").select("teacher_code").eq("id", userId).single()
  if (data) return data.teacher_code
  const code = randomSegment(4)
  await supabase.from("teacher_profiles").insert({ id: userId, teacher_code: code })
  return code
}

async function generateClassCode(supabase: Awaited<ReturnType<typeof createClient>>, teacherId: string) {
  for (let i = 0; i < 20; i++) {
    const code = randomSegment(4)
    const { data } = await supabase
      .from("classes")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("class_code", code)
      .single()
    if (!data) return code
  }
  throw new Error("Could not generate unique class code")
}

async function generateSeats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
  classId: string,
  teacherCode: string,
  classCode: string,
  fromSeat: number,
  toSeat: number
) {
  const rows = Array.from({ length: toSeat - fromSeat + 1 }, (_, i) => {
    const seat = fromSeat + i
    return {
      teacher_id: teacherId,
      class_id: classId,
      seat_number: seat,
      code: `${teacherCode}-${classCode}-${String(seat).padStart(3, "0")}`,
    }
  })
  return supabase.from("licenses").insert(rows).select()
}

// POST — create a new class
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, student_count } = await req.json()
  if (!name || !student_count) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const teacherCode = await getOrCreateTeacherCode(supabase, user.id)
  const classCode = await generateClassCode(supabase, user.id)
  const count = Math.max(1, Math.min(500, parseInt(student_count)))

  const { data: cls, error } = await supabase
    .from("classes")
    .insert({ teacher_id: user.id, name, class_code: classCode, student_count: count })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await generateSeats(supabase, user.id, cls.id, teacherCode, classCode, 1, count)

  return NextResponse.json({ class: cls, teacher_code: teacherCode })
}

// PATCH — update class name or student count
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, name, student_count } = await req.json()

  const [{ data: cls }, { data: profile }] = await Promise.all([
    supabase.from("classes").select("student_count, class_code").eq("id", id).eq("teacher_id", user.id).single(),
    supabase.from("teacher_profiles").select("teacher_code").eq("id", user.id).single(),
  ])

  if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (name) update.name = name

  if (student_count !== undefined) {
    const newCount = Math.max(1, Math.min(500, parseInt(student_count)))
    update.student_count = newCount

    if (newCount > cls.student_count) {
      const teacherCode = profile?.teacher_code
      if (teacherCode) {
        await generateSeats(supabase, user.id, id, teacherCode, cls.class_code, cls.student_count + 1, newCount)
      }
    } else if (newCount < cls.student_count) {
      // Remove unused seats from the top down
      await supabase
        .from("licenses")
        .delete()
        .eq("class_id", id)
        .gt("seat_number", newCount)
        .is("session_token", null)
    }
  }

  const { data: updated } = await supabase.from("classes").update(update).eq("id", id).select().single()
  return NextResponse.json({ class: updated })
}

// DELETE — delete a class
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json()
  await supabase.from("classes").delete().eq("id", id).eq("teacher_id", user.id)
  return NextResponse.json({ ok: true })
}
