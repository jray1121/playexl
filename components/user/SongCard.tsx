import Link from "next/link"
import { Lock } from "lucide-react"
import { baseColorForVoicing } from "@/lib/voicingColors"

export default function SongCard({
  song,
  owned,
  loggedIn,
}: {
  song: {
    id: string
    title: string
    composer: string
    arranger?: string
    voicing: string
    is_acappella: boolean
    price: number
    parts: { name: string; color: string }[]
  }
  owned: boolean
  loggedIn: boolean
}) {
  const colors = song.parts
    ?.filter((p) => p.name !== "full_mix" && p.name !== "piano")
    .map((p) => p.color)
  // Falls back to this voicing's brand color (not a fixed purple) if a song
  // somehow has no part color data yet — keeps the card on-brand either way.
  const primaryColor = colors?.[0] ?? baseColorForVoicing(song.voicing)

  // Build a multi-stop gradient from the part colors
  const gradientStops = colors?.length
    ? colors.slice(0, 4).map((c, i, arr) => `${c} ${Math.round((i / (arr.length - 1 || 1)) * 100)}%`).join(", ")
    : `${primaryColor}, ${primaryColor}88`

  return (
    <div className={`group flex flex-col overflow-hidden rounded-xl transition-all duration-200 ${
      owned
        ? "ring-1 ring-brand/40 hover:ring-brand/70 hover:shadow-xl hover:shadow-brand/10 hover:-translate-y-0.5"
        : "ring-1 ring-zinc-800 hover:ring-zinc-600 hover:shadow-xl hover:shadow-black/50 hover:-translate-y-0.5"
    }`}>

      {/* Color header — real visual area */}
      <div
        className="relative h-16 w-full shrink-0"
        style={{ background: `linear-gradient(135deg, ${gradientStops})` }}
      >
        {/* Dark scrim at bottom so text below reads well */}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-900 to-transparent" />

        {/* Voicing badge pinned top-right */}
        <span className="absolute top-2.5 right-2.5 bg-black/40 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
          {song.voicing}
        </span>

        {/* Owned checkmark */}
        {owned && (
          <span className="absolute top-2.5 left-2.5 bg-brand/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            ✓ Assigned
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="bg-zinc-900 flex flex-col flex-1 px-4 pt-3 pb-4 gap-3">
        <div>
          <h2 className="font-bold text-zinc-100 text-base leading-snug group-hover:text-white transition-colors">
            {song.title}
          </h2>
          <p className="text-zinc-400 text-sm mt-0.5 leading-tight">
            {song.composer}
            {song.arranger && (
              <span className="text-zinc-500"> · arr. {song.arranger}</span>
            )}
          </p>
        </div>

        {song.is_acappella && (
          <span className="text-[10px] text-zinc-500 -mt-1">A Cappella</span>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2">
          {!owned && (
            <span className="text-zinc-300 font-semibold tabular-nums text-sm">
              ${(song.price / 100).toFixed(2)}
            </span>
          )}

          {owned ? (
            <Link
              href={`/songs/${song.id}`}
              className="bg-brand hover:bg-brand-light text-white font-semibold px-4 py-1.5 rounded-lg text-sm transition-all duration-150 shadow hover:shadow-lg hover:shadow-brand/25"
            >
              Practice →
            </Link>
          ) : loggedIn ? (
            <button className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 font-medium px-3.5 py-1.5 rounded-lg text-sm transition-all duration-150">
              <Lock size={12} /> Purchase
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 font-medium px-3.5 py-1.5 rounded-lg text-sm transition-all duration-150"
            >
              <Lock size={12} /> Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
