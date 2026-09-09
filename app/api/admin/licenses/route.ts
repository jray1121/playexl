import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
function generateCode(): string {
  const seg = (n: number) =>
    Array.from({ length: n }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("")
  return `EXL-${seg(4)}-${seg(4)}`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { count = 1 } = await req.json()
  const rows = Array.from({ length: Math.min(count, 50) }, () => ({
    teacher_id: user.id,
    code: generateCode(),
  }))

  const { data, error } = await supabase.from("licenses").insert(rows).select()
  if (error) {
    console.error("licenses insert error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ licenses: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json()
  await supabase.from("licenses").delete().eq("id", id).eq("teacher_id", user.id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, label, reset } = await req.json()
  const update: Record<string, unknown> = {}
  if (label !== undefined) update.label = label || null
  if (reset) {
    update.session_token = null
    update.activated_at = null
    update.last_active_at = null
  }
  const { data } = await supabase.from("licenses").update(update).eq("id", id).eq("teacher_id", user.id).select().single()
  return NextResponse.json({ license: data })
}
