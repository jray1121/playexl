import type { ReactNode } from "react"
import UserNav from "@/components/user/UserNav"

export default function UserLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <UserNav />
      {children}
    </div>
  )
}
