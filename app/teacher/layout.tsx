import type { ReactNode } from "react"
import TeacherNav from "@/components/teacher/TeacherNav"

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TeacherNav />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
