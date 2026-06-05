"use client"
import type { SongPart } from "@/types"

interface Track {
  part: SongPart
  volume: number
  muted: boolean
  soloed: boolean
}

interface Props {
  track: Track
  onVolumeChange: (v: number) => void
  onMuteToggle: () => void
  onSoloToggle: () => void
}

export default function ChannelStrip({ track, onVolumeChange, onMuteToggle, onSoloToggle }: Props) {
  const { part, volume, muted, soloed } = track

  return (
    <div className={`px-4 py-3 flex flex-col gap-2 transition-colors ${muted ? "opacity-40" : ""}`}>
      {/* Part name */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: part.color }} />
          <span className="text-sm font-medium text-zinc-100">{part.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onSoloToggle}
            className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
              soloed
                ? "bg-amber-400 text-zinc-900"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-100"
            }`}
          >
            S
          </button>
          <button
            onClick={onMuteToggle}
            className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
              muted
                ? "bg-red-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-100"
            }`}
          >
            M
          </button>
        </div>
      </div>

      {/* Volume fader */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="flex-1 h-1.5 accent-amber-400 cursor-pointer"
          style={{
            accentColor: part.color,
          }}
        />
        <span className="text-xs text-zinc-500 w-8 text-right tabular-nums">
          {Math.round(volume * 100)}
        </span>
      </div>
    </div>
  )
}
