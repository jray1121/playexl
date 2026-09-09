"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Music, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"

function getStudentLabel(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)student_label=([^;]*)/)
  return match ? decodeURIComponent(match[1]) || null : null
}

export default function UserNav() {
  const [user, setUser] = useState<User | null>(null)
  const [studentLabel, setStudentLabel] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const label = getStudentLabel()
    setStudentLabel(label)
    // Skip Supabase auth entirely for student sessions — no teacher session exists,
    // and the visibility-change token refresh would just throw a noisy fetch error.
    if (label !== null) return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  async function studentSignOut() {
    await fetch("/api/student/logout", { method: "POST" })
    router.push("/student")
    router.refresh()
  }

  return (
    <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-50">
      <div className="h-0.5 w-full bg-gradient-to-r from-brand via-brand-light to-brand opacity-80" />
      <div className="w-full px-6 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand text-lg tracking-wide">
          <Music size={20} />
          MusicEXL
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-zinc-400 text-sm hidden sm:block">{user.email}</span>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <LogOut size={13} /> Sign out
              </button>
            </>
          ) : studentLabel !== null ? (
            <>
              <span className="text-zinc-400 text-sm hidden sm:block">{studentLabel || "Student"}</span>
              <button
                onClick={studentSignOut}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <LogOut size={13} /> Sign out
              </button>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  )
}
