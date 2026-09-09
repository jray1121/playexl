import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { class_id, song_id } = await req.json()

  // Verify teacher owns the class
  const { data: cls } = await supabase.from("classes").select("id").eq("id", class_id).eq("teacher_id", user.id).single()
  if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase.from("class_songs").insert({ class_id, song_id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ class_song: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { class_id, song_id } = await req.json()

  const { data: cls } = await supabase.from("classes").select("id").eq("id", class_id).eq("teacher_id", user.id).single()
  if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await supabase.from("class_songs").delete().eq("class_id", class_id).eq("song_id", song_id)
  return NextResponse.json({ ok: true })
}
