import { createClient as createServerClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function POST(req: NextRequest) {
  const { code } = await req.json()
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code is required" }, { status: 400 })
  }

  // Use service role key so unauthenticated students can validate their code
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const normalized = code.trim().toUpperCase()

  const { data: license, error } = await supabase
    .from("licenses")
    .select("id, code, label, session_token, class_id, classes(name)")
    .eq("code", normalized)
    .single()

  console.log("student login attempt code:", normalized)
  console.log("student login license:", JSON.stringify(license))
  console.log("student login error:", JSON.stringify(error))
  console.log("service key present:", !!process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (error || !license) {
    return NextResponse.json({ error: "Invalid code. Please check with your teacher." }, { status: 401 })
  }

  const sessionToken = randomUUID()
  await supabase
    .from("licenses")
    .update({
      session_token: sessionToken,
      last_active_at: new Date().toISOString(),
      ...(license.session_token ? {} : { activated_at: new Date().toISOString() }),
    })
    .eq("id", license.id)

  const className = (license.classes as unknown as { name: string } | null)?.name ?? "Class"
  const label = license.label ?? className

  const res = NextResponse.json({ ok: true, label })
  const cookieOpts = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  }
  res.cookies.set("student_token", sessionToken, { ...cookieOpts, httpOnly: true })
  res.cookies.set("student_label", label, { ...cookieOpts, httpOnly: false })
  res.cookies.set("student_class_id", license.class_id, { ...cookieOpts, httpOnly: false })
  return res
}
