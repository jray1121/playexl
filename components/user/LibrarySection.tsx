"use client"
import { useEffect, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

interface Props {
  id: string
  label: string
  count: number
  colors: string[]
  children: React.ReactNode
}

export default function LibrarySection({ id, label, count, colors, children }: Props) {
  const storageKey = `playexl-hide-section-${label}`
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(storageKey) === "true") setHidden(true)
  }, [storageKey])

  function toggle() {
    const next = !hidden
    setHidden(next)
    localStorage.setItem(storageKey, String(next))
  }

  return (
    <section
      id={id}
      className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40 scroll-mt-28"
    >
      {/* Color stripe — previews the most complex voicing in this category
          (e.g. SATB for Mixed), so it's visible even when empty */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(to right, ${colors.join(", ")})` }}
      />

      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-bold text-zinc-100 tracking-tight">{label}</h2>
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-xs">
            {count} {count === 1 ? "song" : "songs"}
          </span>
          <button
            onClick={toggle}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {hidden ? <><Eye size={13} /> Show</> : <><EyeOff size={13} /> Hide</>}
          </button>
        </div>
      </div>

      <div className="px-5 py-5">
        {hidden ? (
          <p className="text-zinc-600 text-xs italic">Section hidden — click "Show" to bring it back.</p>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
