"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Music, LogOut, LogIn } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"

export default function UserNav() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
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

  return (
    <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2 font-bold text-amber-400 text-lg tracking-wide">
          <Music size={20} />
          PlayEXL
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-zinc-400 text-sm hidden sm:block">{user.email}</span>
              <button
                onClick={signOut}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1.5">
                <LogIn size={15} /> Sign in
              </Link>
              <Link href="/signup" className="text-sm bg-amber-400 hover:bg-amber-300 text-zinc-900 font-semibold px-3 py-1.5 rounded-lg transition-colors">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
