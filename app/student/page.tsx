"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Music } from "lucide-react"

export default function StudentLoginPage() {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await fetch("/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? "Invalid code. Please check with your teacher.")
      return
    }
    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Music size={36} className="text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Student Access</h1>
          <p className="text-zinc-400 text-sm">Enter the code your teacher gave you</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EXL-XXXX-XXXX"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 text-center text-xl font-mono tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-brand"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.trim().length < 4}
            className="w-full bg-brand hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed text-zinc-900 font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>

        <p className="text-center text-zinc-600 text-xs">
          No account or personal information needed.
        </p>
      </div>
    </div>
  )
}
