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
  function handleMeasureKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const m = parseInt(measureInput)
      if (!isNaN(m) && m > 0) onJumpToMeasure(m)
    }
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 shrink-0">
      {/* Seek bar — full width on top */}
      <div className="px-4 pt-3 flex items-center gap-3">
        <span className="text-xs text-zinc-500 tabular-nums w-10 shrink-0">
          {formatTime(currentTime)}
        </span>
        <div className="relative flex-1 h-5 flex items-center group">
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
          {/* Playhead thumb */}
          <div
            className="absolute w-3 h-3 rounded-full bg-brand shadow-md pointer-events-none"
            style={{
              left: duration ? `calc(${(currentTime / duration) * 100}% - 6px)` : "-6px",
              boxShadow: "0 0 8px #87399599",
            }}
          />
        </div>
        <span className="text-xs text-zinc-500 tabular-nums w-10 text-right shrink-0">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="px-4 py-3 flex items-center justify-center gap-6">

        {/* Playback buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onSeek(0)}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors"
            title="Return to start"
          >
            <SkipBack size={15} />
          </button>
          <button
            onClick={onTogglePlay}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg"
            style={{
              background: playing ? "#f59e0b" : "#873995",
              boxShadow: playing ? "0 0 20px #87399580" : "none",
            }}
          >
            {playing
              ? <Pause size={20} className="text-zinc-900" />
              : <Play size={20} className="text-zinc-900 translate-x-0.5" />
            }
          </button>
        </div>

        {/* BAR : BEAT counter */}
        {beatMapReady && (
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2 shadow-inner">
            <div className="text-center">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest leading-none mb-1">Bar</p>
              <p className="text-4xl font-black tabular-nums leading-none text-brand" style={{ textShadow: "0 0 20px #87399966" }}>
                {currentBeat ? String(currentBeat.measure).padStart(2, "0") : "—"}
              </p>
            </div>
            <div className="text-3xl font-black text-zinc-600 pb-1 mx-1">:</div>
            <div className="text-center">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest leading-none mb-1">Beat</p>
              <p className="text-4xl font-black tabular-nums leading-none text-brand" style={{ textShadow: "0 0 20px #87399966" }}>
                {currentBeat ? currentBeat.beat : "—"}
              </p>
            </div>
          </div>
        )}

        {/* Measure jump */}
        {beatMapReady && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 shrink-0">Go to bar</span>
            <input
              type="number"
              min={1}
              value={measureInput}
              onChange={(e) => onMeasureInputChange(e.target.value)}
              onKeyDown={handleMeasureKey}
              placeholder="1"
              className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-brand tabular-nums text-center"
            />
            <button
              onClick={() => {
                const m = parseInt(measureInput)
                if (!isNaN(m) && m > 0) onJumpToMeasure(m)
              }}
              className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              Go
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
