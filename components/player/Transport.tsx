"use client"
import type { BeatMapEntry } from "@/types"

interface Props {
  playing: boolean
  currentTime: number
  duration: number
  currentBeat: BeatMapEntry | null
  beatMapReady: boolean
  measureInput: string
  onMeasureInputChange: (v: string) => void
  onTogglePlay: () => void
  onSeek: (seconds: number) => void
  onJumpToMeasure: (measure: number) => void
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function Transport({ currentTime, duration, onSeek }: Props) {
  return (
    <div className="border-t border-zinc-800 bg-zinc-950 shrink-0 px-4 py-2 flex items-center gap-3">
      <span className="text-xs text-zinc-500 tabular-nums w-9 text-right shrink-0">
        {formatTime(currentTime)}
      </span>
      <div className="relative flex-1 h-5 flex items-center">
        <div className="absolute inset-x-0 h-1 rounded-full bg-zinc-700" />
        <div
          className="absolute h-1 rounded-full bg-brand left-0"
          style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
        />
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ zIndex: 10 }}
        />
        <div
          className="absolute w-2.5 h-2.5 rounded-full bg-brand shadow-md pointer-events-none"
          style={{
            left: duration ? `calc(${(currentTime / duration) * 100}% - 5px)` : "-5px",
            boxShadow: "0 0 6px #87399599",
          }}
        />
      </div>
      <span className="text-xs text-zinc-500 tabular-nums w-9 shrink-0">
        {formatTime(duration)}
      </span>
    </div>
  )
}
