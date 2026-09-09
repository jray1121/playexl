import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
function randomCode(len: number) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("")
}

async function getOrCreateTeacherCode(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("teacher_profiles")
    .select("teacher_code")
    .eq("id", userId)
    .single()

  if (profile) return profile.teacher_code

  // Generate a unique 4-char teacher code
  let code = ""
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = randomCode(4)
    const { data: existing } = await supabase
      .from("teacher_profiles")
      .select("id")
      .eq("teacher_code", candidate)
      .single()
    if (!existing) { code = candidate; break }
  }

  await supabase.from("teacher_profiles").insert({ id: userId, teacher_code: code })
  return code
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { song_id, quantity } = await req.json()
  if (!song_id || !quantity) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const qty = Math.min(Math.max(1, parseInt(quantity)), 200)

  // Get sku
  const { data: song } = await supabase.from("songs").select("sku, title").eq("id", song_id).single()
  if (!song?.sku) return NextResponse.json({ error: "Song has no code assigned — add one in the song editor first." }, { status: 400 })

  const teacherCode = await getOrCreateTeacherCode(supabase, user.id)

  // Find current highest seat number for this teacher + song
  const { data: existing } = await supabase
    .from("licenses")
    .select("seat_number")
    .eq("teacher_id", user.id)
    .eq("song_id", song_id)
    .order("seat_number", { ascending: false })
    .limit(1)

  const nextSeat = (existing?.[0]?.seat_number ?? 0) + 1

  const rows = Array.from({ length: qty }, (_, i) => {
    const seat = nextSeat + i
    const code = `${teacherCode}-${song.sku}-${String(seat).padStart(3, "0")}`
    return { teacher_id: user.id, song_id, seat_number: seat, code }
  })

  const { data, error } = await supabase.from("licenses").insert(rows).select()
  if (error) {
    console.error("purchase error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ licenses: data, teacher_code: teacherCode, sku: song.sku })
}
