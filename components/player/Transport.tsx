"use client"
import { Play, Pause, SkipBack } from "lucide-react"
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

export default function Transport({
  playing,
  currentTime,
  duration,
  currentBeat,
  beatMapReady,
  measureInput,
  onMeasureInputChange,
  onTogglePlay,
  onSeek,
  onJumpToMeasure,
}: Props) {
  function handleMeasureJump(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const m = parseInt(measureInput)
      if (!isNaN(m) && m > 0) onJumpToMeasure(m)
    }
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 px-6 py-3 shrink-0">
      <div className="flex items-center gap-4">

        {/* Play controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onSeek(0)}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Return to start"
          >
            <SkipBack size={18} />
          </button>
          <button
            onClick={onTogglePlay}
            className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-300 text-zinc-900 flex items-center justify-center transition-colors"
          >
            {playing ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
          </button>
        </div>

        {/* Time display */}
        <span className="text-sm tabular-nums text-zinc-300 shrink-0 w-24">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Seek scrubber */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="flex-1 h-1.5 accent-amber-400 cursor-pointer"
        />

        {/* Beat display */}
        {beatMapReady && (
          <div className="shrink-0 flex items-center gap-3">
            <div className="bg-zinc-800 rounded-lg px-3 py-1.5 text-center min-w-[80px]">
              <p className="text-xs text-zinc-500 leading-none mb-0.5">BAR : BEAT</p>
              <p className="text-lg font-bold tabular-nums text-amber-400 leading-none">
                {currentBeat ? `${currentBeat.measure} : ${currentBeat.beat}` : "— : —"}
              </p>
            </div>

            {/* Measure jump */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-zinc-500 shrink-0">Go to bar</label>
              <input
                type="number"
                min={1}
                value={measureInput}
                onChange={(e) => onMeasureInputChange(e.target.value)}
                onKeyDown={handleMeasureJump}
                placeholder="1"
                className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-400 tabular-nums"
              />
              <button
                onClick={() => {
                  const m = parseInt(measureInput)
                  if (!isNaN(m) && m > 0) onJumpToMeasure(m)
                }}
                className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-100 px-2 py-1 rounded transition-colors"
              >
                Go
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
