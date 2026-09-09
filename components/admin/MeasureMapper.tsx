"use client"
import { useState, useRef, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Undo2, Save, Loader2, CheckCircle, X, GripHorizontal } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { MeasurePosition } from "@/types"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

const PAGE_WIDTH = 900
const PAGE_GAP = 24

interface Props {
  songId: string
  songTitle: string
  pdfUrl: string
  initialPositions?: MeasurePosition[]
  totalMeasures?: number
}

export default function MeasureMapper({
  songId,
  songTitle,
  pdfUrl,
  initialPositions = [],
  totalMeasures,
}: Props) {
  const router = useRouter()
  const [numPages, setNumPages] = useState(0)
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }[]>([])
  const [positions, setPositions] = useState<MeasurePosition[]>(initialPositions)
  const [nextMeasure, setNextMeasure] = useState(
    initialPositions.length > 0
      ? Math.max(...initialPositions.map((p) => p.measure)) + 1
      : 1
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [highlightedMeasure, setHighlightedMeasure] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Drag state (all in refs to avoid re-renders during drag)
  const draggingRef = useRef<{ measure: number; pageIndex: number } | null>(null)
  const didDragRef = useRef(false)

  function pageTopOffset(pageIndex: number): number {
    // Pages are centered in the scroll container — find the page wrapper's top
    // We stack them with PAGE_GAP + py-6 (24px) top padding
    let offset = 24 // py-6
    for (let i = 0; i < pageIndex; i++) {
      offset += (pageDimensions[i]?.height ?? 0) + PAGE_GAP
    }
    return offset
  }

  function getYPercentFromMouseY(mouseYInContainer: number, pageIndex: number): number {
    const pageTop = pageTopOffset(pageIndex)
    const pageH = pageDimensions[pageIndex]?.height ?? 1
    const yWithinPage = mouseYInContainer - pageTop
    return Math.max(0, Math.min(1, yWithinPage / pageH))
  }

  // ── Place new marker on click ─────────────────────────────────────────────

  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    // Don't place if user was dragging
    if (didDragRef.current) { didDragRef.current = false; return }

    const container = containerRef.current
    if (!container || numPages === 0) return

    const rect = container.getBoundingClientRect()
    const scrollTop = container.scrollTop
    const clickY = e.clientY - rect.top + scrollTop

    // Find which page was clicked
    let targetPageIndex = -1
    let runningY = 24 // py-6 top padding
    for (let i = 0; i < numPages; i++) {
      const h = pageDimensions[i]?.height ?? 0
      if (clickY >= runningY && clickY <= runningY + h) {
        targetPageIndex = i
        break
      }
      runningY += h + PAGE_GAP
    }
    if (targetPageIndex === -1) return

    const pageH = pageDimensions[targetPageIndex]?.height ?? 1
    const yWithinPage = clickY - pageTopOffset(targetPageIndex)
    const yPercent = Math.max(0, Math.min(1, yWithinPage / pageH))

    const newPos: MeasurePosition = {
      measure: nextMeasure,
      page: targetPageIndex + 1,
      yPercent,
    }

    setPositions((prev) => {
      const filtered = prev.filter((p) => p.measure !== nextMeasure)
      return [...filtered, newPos].sort((a, b) => a.measure - b.measure)
    })
    setNextMeasure((m) => m + 1)
    setSaved(false)
  }

  // ── Drag to reposition ────────────────────────────────────────────────────

  function handlePinMouseDown(e: React.MouseEvent, measure: number, pageIndex: number) {
    e.stopPropagation()
    e.preventDefault()
    draggingRef.current = { measure, pageIndex }
    didDragRef.current = false
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return
      didDragRef.current = true

      const container = containerRef.current
      if (!container) return

      const { measure, pageIndex } = draggingRef.current
      const rect = container.getBoundingClientRect()
      const scrollTop = container.scrollTop
      const mouseY = e.clientY - rect.top + scrollTop
      const yPercent = getYPercentFromMouseY(mouseY, pageIndex)

      setPositions((prev) =>
        prev.map((p) => (p.measure === measure ? { ...p, yPercent } : p))
      )
      setSaved(false)
    }

    function onMouseUp() {
      draggingRef.current = null
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [pageDimensions])

  // ── Delete ────────────────────────────────────────────────────────────────

  function deletePosition(measure: number) {
    setPositions((prev) => {
      const next = prev.filter((p) => p.measure !== measure)
      // Keep "next measure" in sync: if nothing is left, go back to 1.
      // If we deleted the highest-numbered marker, pull the counter back
      // down to match it — otherwise it stays stuck wherever it was,
      // regardless of what order things get deleted in.
      setNextMeasure((nm) => {
        if (next.length === 0) return 1
        const highest = Math.max(...next.map((p) => p.measure)) + 1
        return measure === nm - 1 ? highest : nm
      })
      return next
    })
    setSaved(false)
  }

  function resetAll() {
    if (positions.length > 0 && !confirm("Clear all mapped measures and start over from measure 1?")) return
    setPositions([])
    setNextMeasure(1)
    setSaved(false)
  }

  // ── Undo ─────────────────────────────────────────────────────────────────

  function undoLast() {
    if (positions.length === 0) return
    const sorted = [...positions].sort((a, b) => a.measure - b.measure)
    const last = sorted[sorted.length - 1]
    setPositions((prev) => prev.filter((p) => p.measure !== last.measure))
    setNextMeasure(last.measure)
    setSaved(false)
  }

  // ── Scroll to position ────────────────────────────────────────────────────

  function scrollToPosition(pos: MeasurePosition) {
    const container = containerRef.current
    if (!container) return
    const top = pageTopOffset(pos.page - 1) + pos.yPercent * (pageDimensions[pos.page - 1]?.height ?? 0)
    container.scrollTo({ top: top - 200, behavior: "smooth" })
    setHighlightedMeasure(pos.measure)
    setTimeout(() => setHighlightedMeasure(null), 1500)
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from("songs")
      .update({ measure_positions: positions })
      .eq("id", songId)
    setSaving(false)
    setSaved(true)
  }

  const pageDimsReady = pageDimensions.filter(Boolean).length === numPages && numPages > 0

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0" style={{ cursor: draggingRef.current ? "grabbing" : undefined }}>

      {/* ── PDF panel ───────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-zinc-950 cursor-crosshair relative select-none"
        onClick={handleContainerClick}
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
              Loading PDF…
            </div>
          }
        >
          <div className="flex flex-col items-center py-6" style={{ gap: PAGE_GAP }}>
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i} className="relative">
                <Page
                  pageNumber={i + 1}
                  width={PAGE_WIDTH}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onRenderSuccess={(page) => {
                    setPageDimensions((prev) => {
                      const next = [...prev]
                      next[i] = { width: page.width, height: page.height }
                      return next
                    })
                  }}
                  className="shadow-2xl"
                />

                {/* Pins for this page */}
                {pageDimsReady && positions
                  .filter((p) => p.page === i + 1)
                  .map((pos) => {
                    const isHighlighted = highlightedMeasure === pos.measure
                    const isDraggingThis = draggingRef.current?.measure === pos.measure
                    return (
                      <div
                        key={pos.measure}
                        className="absolute left-0 right-0 flex items-center"
                        style={{
                          top: `${pos.yPercent * 100}%`,
                          transform: "translateY(-50%)",
                          zIndex: isDraggingThis ? 50 : 10,
                        }}
                      >
                        {/* Horizontal rule */}
                        <div
                          className="absolute inset-x-0 h-px"
                          style={{
                            background: isHighlighted
                              ? "#fbbf24"
                              : isDraggingThis
                              ? "#fbbf24"
                              : "rgba(251,191,36,0.35)",
                          }}
                        />

                        {/* Measure badge + drag handle */}
                        <div
                          className="relative flex items-center gap-1 bg-amber-400 text-zinc-900 text-xs font-bold rounded shadow-lg pl-1.5 pr-1 py-0.5 cursor-grab active:cursor-grabbing select-none"
                          onMouseDown={(e) => handlePinMouseDown(e, pos.measure, i)}
                          onClick={(e) => e.stopPropagation()}
                          title={`Drag to reposition measure ${pos.measure}`}
                        >
                          <GripHorizontal size={10} className="opacity-60" />
                          {pos.measure}
                        </div>

                        {/* Delete button */}
                        <button
                          className="relative ml-1 w-4 h-4 flex items-center justify-center rounded-full bg-zinc-700 hover:bg-red-500 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); deletePosition(pos.measure) }}
                          title={`Remove measure ${pos.measure}`}
                        >
                          <X size={9} />
                        </button>
                      </div>
                    )
                  })}
              </div>
            ))}
          </div>
        </Document>

        {/* Prompt */}
        {numPages > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur border border-amber-400/30 rounded-full px-5 py-2 text-sm text-amber-400 font-medium pointer-events-none shadow-xl">
            Click to mark start of measure {nextMeasure} · drag pins to reposition
          </div>
        )}
      </div>

      {/* ── Control panel ───────────────────────────────────────────────── */}
      <div className="w-64 border-l border-zinc-800 bg-zinc-900 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-zinc-800 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Mapping</p>
            <p className="font-semibold text-zinc-100 text-sm truncate">{songTitle}</p>
          </div>
          <button
            onClick={resetAll}
            title="Clear all markers and start over from measure 1"
            className="shrink-0 text-[10px] font-semibold text-zinc-500 hover:text-red-400 bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded transition-colors"
          >
            Reset All
          </button>
        </div>

        {/* Status */}
        <div className="px-4 py-4 border-b border-zinc-800 space-y-3">
          <div className="bg-zinc-800 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Next measure</p>
            <p className="text-3xl font-bold text-amber-400 tabular-nums">{nextMeasure}</p>
          </div>
          <p className="text-xs text-zinc-500 text-center">
            {positions.length} of {totalMeasures ?? "?"} measures mapped
          </p>

          {/* Jump to measure */}
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              placeholder="Jump to #"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = parseInt((e.target as HTMLInputElement).value)
                  if (!isNaN(v)) setNextMeasure(v)
                }
              }}
            />
            <button
              onClick={undoLast}
              title="Undo last pin"
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 rounded transition-colors"
            >
              <Undo2 size={15} />
            </button>
          </div>
        </div>

        {/* Mapped list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Mapped measures</p>
          {positions.length === 0 ? (
            <p className="text-xs text-zinc-600">None yet — click the PDF to start</p>
          ) : (
            [...positions].sort((a, b) => a.measure - b.measure).map((pos) => (
              <div
                key={pos.measure}
                className={`w-full flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors ${
                  highlightedMeasure === pos.measure ? "bg-amber-400/10" : "hover:bg-zinc-800"
                }`}
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => scrollToPosition(pos)}
                >
                  <span className="text-zinc-100 font-medium">Measure {pos.measure}</span>
                  <span className="text-zinc-500 ml-2">p.{pos.page} · {Math.round(pos.yPercent * 100)}%</span>
                </button>
                <button
                  onClick={() => deletePosition(pos.measure)}
                  className="ml-2 p-0.5 text-zinc-600 hover:text-red-400 transition-colors rounded"
                  title="Delete"
                >
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Save */}
        <div className="px-4 py-4 border-t border-zinc-800">
          <button
            onClick={save}
            disabled={saving || positions.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-900 font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : saved ? (
              <><CheckCircle size={14} /> Saved</>
            ) : (
              <><Save size={14} /> Save positions</>
            )}
          </button>
          <button
            onClick={() => router.back()}
            className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 mt-2 transition-colors"
          >
            ← Back to song
          </button>
        </div>
      </div>
    </div>
  )
}
