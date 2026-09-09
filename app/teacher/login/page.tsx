"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Music } from "lucide-react"

export default function TeacherLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push("/teacher"); router.refresh() }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-2">
          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
            <Music className="text-brand" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Teacher Sign In</h1>
          <p className="text-zinc-400 text-sm">Sign in to manage your classes and licenses</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-brand text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-brand text-sm" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-brand hover:bg-brand-light disabled:opacity-50 text-zinc-900 font-semibold py-2 rounded-lg transition-colors text-sm">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-zinc-400 text-sm mt-6">
          Don't have an account?{" "}
          <Link href="/teacher/signup" className="text-brand hover:underline">Sign up</Link>
        </p>
        <p className="text-center text-zinc-600 text-xs mt-3">
          Student?{" "}
          <Link href="/student" className="hover:text-zinc-400">Enter your student code here</Link>
        </p>
      </div>
    </div>
  )
}
