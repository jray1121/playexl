"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Music, LayoutDashboard, LogOut, Users, Library } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const links = [
  { href: "/teacher", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher/classes", label: "Classes", icon: Users },
  { href: "/teacher/store", label: "Song Store", icon: Music },
  { href: "/", label: "Library", icon: Library },
]

export default function TeacherNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/teacher/login")
  }

  return (
    <nav className="border-b border-zinc-800 bg-zinc-900">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-8">
          <span className="font-bold text-brand tracking-wide text-lg">PlayEXL</span>
          <div className="flex gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors",
                  pathname === href || (href !== "/teacher" && pathname.startsWith(href))
                    ? "bg-brand/10 text-brand"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </nav>
  )
}
