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
    <div className="border-t border-zinc-800 bg-zinc-900 shrink-0 px-4 py-2 flex items-center gap-3">

      {/* Skip + Play */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onSeek(0)}
          className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors"
          title="Return to start"
        >
          <SkipBack size={13} />
        </button>
        <button
          onClick={onTogglePlay}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg shrink-0"
          style={{
            background: playing ? "#f59e0b" : "#873995",
            boxShadow: playing ? "0 0 16px #87399580" : "none",
          }}
        >
          {playing
            ? <Pause size={16} className="text-zinc-900" />
            : <Play size={16} className="text-zinc-900 translate-x-0.5" />
          }
        </button>
      </div>

      {/* Time + Seek bar */}
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

      {/* BAR : BEAT counter */}
      {beatMapReady && (
        <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1 shrink-0">
          <div className="text-center">
            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest leading-none mb-0.5">Bar</p>
            <p className="text-2xl font-black tabular-nums leading-none text-brand" style={{ textShadow: "0 0 14px #87399966" }}>
              {currentBeat ? String(currentBeat.measure).padStart(2, "0") : "—"}
            </p>
          </div>
          <div className="text-xl font-black text-zinc-600 pb-0.5 mx-0.5">:</div>
          <div className="text-center">
            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest leading-none mb-0.5">Beat</p>
            <p className="text-2xl font-black tabular-nums leading-none text-brand" style={{ textShadow: "0 0 14px #87399966" }}>
              {currentBeat ? currentBeat.beat : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Go to bar */}
      {beatMapReady && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-zinc-500 hidden lg:inline">Go to bar</span>
          <input
            type="number"
            min={1}
            value={measureInput}
            onChange={(e) => onMeasureInputChange(e.target.value)}
            onKeyDown={handleMeasureKey}
            placeholder="1"
            className="w-14 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-brand tabular-nums text-center"
          />
          <button
            onClick={() => {
              const m = parseInt(measureInput)
              if (!isNaN(m) && m > 0) onJumpToMeasure(m)
            }}
            className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
          >
            Go
          </button>
        </div>
      )}
    </div>
  )
}
