"use client"
import type { SongPart } from "@/types"

const HIDDEN_PARTS: string[] = []
const PIANO_PARTS = ["piano"]

interface Track {
  part: SongPart
  volume: number
  muted: boolean
  soloed: boolean
}

interface Props {
  track: Track
  index: number
  baseColor: string
  onVolumeChange: (v: number) => void
  onSoloToggle: () => void
  hideSolo?: boolean
}

export default function ChannelStrip({ track, index, baseColor, onVolumeChange, onSoloToggle, hideSolo }: Props) {
  const { part, volume, soloed } = track

  if (HIDDEN_PARTS.includes(part.name)) return null

  const isPiano = PIANO_PARTS.includes(part.name)

  return (
    <div
      className="relative h-full pl-4 pr-5 py-2 flex flex-col gap-1.5 justify-center border-b-2 border-zinc-700 hover:bg-zinc-900/60 transition-colors"
      style={{ backgroundImage: `linear-gradient(to left, ${baseColor}44, transparent 85%)` }}
    >
      {/* Left color accent bar — uses per-part shade for subtle differentiation */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ background: part.color, opacity: soloed ? 1 : 0.4 }}
      />

      {/* Part name + solo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: baseColor,
              boxShadow: soloed ? `0 0 6px ${baseColor}` : "none",
            }}
          />
          <span className="text-sm font-semibold text-zinc-200 tracking-wide">
            {part.label}
          </span>
        </div>
        {!isPiano && !hideSolo && (
          <button
            onClick={onSoloToggle}
            className="px-2.5 py-0.5 rounded text-[10px] font-bold tracking-widest transition-all duration-150 border"
            style={
              soloed
                ? {
                    background: baseColor + "25",
                    color: baseColor,
                    borderColor: baseColor + "60",
                    boxShadow: `0 0 8px ${baseColor}40`,
                  }
                : {
                    background: "transparent",
                    color: "#e4e4e7",
                    borderColor: "#71717a",
                  }
            }
          >
            SOLO
          </button>
        )}
      </div>

      {/* Fader */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1 h-5 flex items-center">
          {/* Groove */}
          <div className="absolute inset-x-0 h-1 rounded-full bg-zinc-700/80" />
          {/* Fill */}
          <div
            className="absolute h-1 rounded-full left-0 transition-none"
            style={{ width: `${volume * 100}%`, background: baseColor, opacity: 0.65 }}
          />
          {/* Hidden range input */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-5 cursor-pointer opacity-0"
            style={{ zIndex: 10 }}
          />
          {/* Thumb */}
          <div
            className="absolute w-3.5 h-3.5 rounded-full bg-zinc-900 border-2 shadow pointer-events-none transition-none"
            style={{
              left: `calc(${volume * 100}% - 7px)`,
              borderColor: baseColor,
              boxShadow: `0 1px 4px rgba(0,0,0,0.6)`,
            }}
          />
        </div>
        <span
          className="text-[11px] font-mono w-8 text-right tabular-nums shrink-0"
          style={{ color: volume > 0 ? baseColor : "#52525b" }}
        >
          {Math.round(volume * 100)}
        </span>
      </div>
    </div>
  )
}
