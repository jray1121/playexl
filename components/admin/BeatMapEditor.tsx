"use client"
import { Plus, Trash2 } from "lucide-react"
import type { TimeSigChange } from "@/types"
import { cn } from "@/lib/utils"

interface Props {
  timeSigMap: TimeSigChange[]
  onChange: (map: TimeSigChange[]) => void
}

const inputCls =
  "bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-sm focus:outline-none focus:border-amber-400 w-full"

export default function BeatMapEditor({ timeSigMap, onChange }: Props) {
  function update(index: number, field: keyof TimeSigChange, value: number) {
    const next = timeSigMap.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    )
    onChange(next)
  }

  function add() {
    const lastMeasure = timeSigMap[timeSigMap.length - 1]?.measure ?? 0
    onChange([
      ...timeSigMap,
      { measure: lastMeasure + 8, numerator: 4, denominator: 4, clickNoteValue: 4 },
    ])
  }

  function remove(index: number) {
    if (timeSigMap.length === 1) return // always keep at least one
    onChange(timeSigMap.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Time Signature Map</h3>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          <Plus size={13} /> Add change
        </button>
      </div>

      <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-2 text-xs text-zinc-500 px-1">
        <span></span>
        <span>Start measure</span>
        <span>Numerator</span>
        <span>Denominator</span>
        <span>Click = note value</span>
        <span></span>
      </div>

      {timeSigMap.map((entry, i) => (
        <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
          <span className="text-xs text-zinc-500 w-5 text-right">{i + 1}</span>

          <input
            type="number"
            min={1}
            value={entry.measure}
            onChange={(e) => update(i, "measure", parseInt(e.target.value) || 1)}
            disabled={i === 0}
            className={cn(inputCls, i === 0 && "opacity-50 cursor-not-allowed")}
            title="Measure where this time signature begins"
          />

          <select
            value={entry.numerator}
            onChange={(e) => update(i, "numerator", parseInt(e.target.value))}
            className={inputCls}
            title="Beats per measure"
          >
            {[2, 3, 4, 5, 6, 7, 8, 9, 12].map((n) => <option key={n}>{n}</option>)}
          </select>

          <select
            value={entry.denominator}
            onChange={(e) => update(i, "denominator", parseInt(e.target.value))}
            className={inputCls}
            title="Beat note value"
          >
            {[2, 4, 8, 16].map((n) => (
              <option key={n} value={n}>
                {n} ({noteValueLabel(n)})
              </option>
            ))}
          </select>

          <select
            value={entry.clickNoteValue}
            onChange={(e) => update(i, "clickNoteValue", parseInt(e.target.value))}
            className={inputCls}
            title="What note value does each click represent?"
          >
            {[2, 4, 8, 16].map((n) => (
              <option key={n} value={n}>
                {n} ({noteValueLabel(n)})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => remove(i)}
            disabled={i === 0}
            className="text-zinc-600 hover:text-red-400 disabled:opacity-20 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <p className="text-xs text-zinc-500">
        Row 1 always starts at measure 1. Add rows for every time signature change in the piece.
        "Click = note value" tells the analyzer what rhythmic value each click tick represents
        (quarter-note click = 4, eighth-note click = 8, etc.).
      </p>
    </div>
  )
}

function noteValueLabel(n: number) {
  return { 2: "half", 4: "quarter", 8: "eighth", 16: "16th" }[n] ?? n
}
