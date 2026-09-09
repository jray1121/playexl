import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase())

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ""
  const isAdmin = ADMIN_EMAILS.includes(email)

  const path = request.nextUrl.pathname
  const studentToken = request.cookies.get("student_token")?.value

  // ── Admin routes ─────────────────────────────────────────────────────────
  if (path.startsWith("/admin")) {
    if (path === "/admin/login") {
      if (user && isAdmin) return NextResponse.redirect(new URL("/admin", request.url))
      return supabaseResponse
    }
    if (!user) return NextResponse.redirect(new URL("/admin/login", request.url))
    if (!isAdmin) return NextResponse.redirect(new URL("/teacher", request.url))
    return supabaseResponse
  }

  // ── Teacher routes ────────────────────────────────────────────────────────
  if (path.startsWith("/teacher")) {
    if (path === "/teacher/login" || path === "/teacher/signup") {
      if (user) return NextResponse.redirect(new URL("/teacher", request.url))
      return supabaseResponse
    }
    if (!user) return NextResponse.redirect(new URL("/teacher/login", request.url))
    return supabaseResponse
  }

  // ── Student / public routes ───────────────────────────────────────────────
  if (path === "/" || path.startsWith("/songs")) {
    if (!user && !studentToken) {
      return NextResponse.redirect(new URL("/student", request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*", "/", "/songs/:path*"],
}
