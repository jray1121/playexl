"use client"
import type { SongPart } from "@/types"

const HIDDEN_PARTS = ["full_mix"]
const PIANO_PARTS = ["piano"]

interface Track {
  part: SongPart
  volume: number
  muted: boolean
  soloed: boolean
}

interface Props {
  track: Track
  onVolumeChange: (v: number) => void
  onSoloToggle: () => void
}

export default function ChannelStrip({ track, onVolumeChange, onSoloToggle }: Props) {
  const { part, volume, soloed } = track

  if (HIDDEN_PARTS.includes(part.name)) return null

  const isPiano = PIANO_PARTS.includes(part.name)

  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      {/* Part name + solo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
            style={{ background: part.color, boxShadow: `0 0 6px ${part.color}60` }}
          />
          <span className="text-sm font-semibold text-zinc-100 tracking-wide">
            {part.label}
          </span>
        </div>
        {!isPiano && (
          <button
            onClick={onSoloToggle}
            className="px-3 py-0.5 rounded-full text-xs font-bold tracking-widest transition-all duration-150"
            style={
              soloed
                ? { background: part.color, color: "#18181b", boxShadow: `0 0 10px ${part.color}80` }
                : { background: "#27272a", color: "#71717a" }
            }
          >
            SOLO
          </button>
        )}
      </div>

      {/* Fader */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 h-5 flex items-center">
          {/* Track groove */}
          <div className="absolute inset-y-0 left-0 right-0 flex items-center">
            <div className="w-full h-1.5 rounded-full bg-zinc-700" />
            {/* Filled portion */}
            <div
              className="absolute h-1.5 rounded-full left-0 transition-none"
              style={{ width: `${volume * 100}%`, background: part.color, opacity: 0.7 }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="relative w-full h-5 cursor-pointer opacity-0 absolute"
            style={{ zIndex: 10 }}
          />
          {/* Thumb indicator */}
          <div
            className="absolute w-4 h-4 rounded-full border-2 border-zinc-300 bg-zinc-900 shadow-md pointer-events-none transition-none"
            style={{
              left: `calc(${volume * 100}% - 8px)`,
              borderColor: part.color,
            }}
          />
        </div>
        <span
          className="text-xs font-mono w-9 text-right tabular-nums"
          style={{ color: part.color }}
        >
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  )
}
