"use client"
import { useState, useRef, useCallback } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Undo2, Save, Loader2, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { MeasurePosition } from "@/types"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

const PAGE_WIDTH = 900
const PAGE_GAP = 24  // px gap between pages

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
  const containerRef = useRef<HTMLDivElement>(null)

  // Record page height as each page renders
  function onPageLoad(pageIndex: number, width: number, height: number) {
    setPageDimensions((prev) => {
      const next = [...prev]
      next[pageIndex] = { width, height }
      return next
    })
  }

  // Calculate Y offset of a page within the scroll container
  function pageTopOffset(pageIndex: number): number {
    let offset = 0
    for (let i = 0; i < pageIndex; i++) {
      offset += (pageDimensions[i]?.height ?? 0) + PAGE_GAP
    }
    return offset
  }

  // Handle click on the PDF container
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const container = containerRef.current
    if (!container || numPages === 0) return

    const rect = container.getBoundingClientRect()
    const scrollTop = container.scrollTop
    const clickY = e.clientY - rect.top + scrollTop
    const clickX = e.clientX - rect.left

    // Find which page was clicked
    let targetPage = 0
    let yWithinPage = 0
    let runningY = 0

    for (let i = 0; i < numPages; i++) {
      const h = pageDimensions[i]?.height ?? 0
      const pageStart = runningY
      const pageEnd = runningY + h

      if (clickY >= pageStart && clickY <= pageEnd) {
        targetPage = i + 1  // 1-indexed
        yWithinPage = clickY - pageStart
        break
      }
      runningY += h + PAGE_GAP
    }

    if (targetPage === 0) return

    const pageH = pageDimensions[targetPage - 1]?.height ?? 1
    const yPercent = Math.max(0, Math.min(1, yWithinPage / pageH))

    const newPos: MeasurePosition = {
      measure: nextMeasure,
      page: targetPage,
      yPercent,
    }

    setPositions((prev) => {
      // Replace if measure already exists
      const filtered = prev.filter((p) => p.measure !== nextMeasure)
      return [...filtered, newPos].sort((a, b) => a.measure - b.measure)
    })
    setNextMeasure((m) => m + 1)
    setSaved(false)
  }

  function undoLast() {
    if (positions.length === 0) return
    const sorted = [...positions].sort((a, b) => a.measure - b.measure)
    const last = sorted[sorted.length - 1]
    setPositions((prev) => prev.filter((p) => p.measure !== last.measure))
    setNextMeasure(last.measure)
    setSaved(false)
  }

  function jumpToMeasure(measure: number) {
    setNextMeasure(measure)
  }

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

  // Scroll the PDF to show where a mapped measure is
  function scrollToPosition(pos: MeasurePosition) {
    const container = containerRef.current
    if (!container) return
    const top = pageTopOffset(pos.page - 1) + pos.yPercent * (pageDimensions[pos.page - 1]?.height ?? 0)
    container.scrollTo({ top: top - 200, behavior: "smooth" })
  }

  const mappedMeasures = new Set(positions.map((p) => p.measure))

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0">

      {/* ── PDF panel ─────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-zinc-950 cursor-crosshair relative"
        onClick={handleClick}
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
                  onRenderSuccess={(page) => onPageLoad(i, page.width, page.height)}
                  className="shadow-2xl"
                />
                {/* Pins for mapped measures on this page */}
                {positions
                  .filter((p) => p.page === i + 1)
                  .map((pos) => (
                    <div
                      key={pos.measure}
                      className="absolute left-0 flex items-center gap-1 pointer-events-none"
                      style={{ top: `${pos.yPercent * 100}%`, transform: "translateY(-50%)" }}
                    >
                      <div className="bg-amber-400 text-zinc-900 text-xs font-bold px-1.5 py-0.5 rounded shadow-lg">
                        {pos.measure}
                      </div>
                      <div className="h-px bg-amber-400/40 w-full" style={{ width: PAGE_WIDTH }} />
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </Document>

        {/* Click prompt overlay */}
        {numPages > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur border border-amber-400/30 rounded-full px-5 py-2 text-sm text-amber-400 font-medium pointer-events-none shadow-xl">
            Click to mark start of measure {nextMeasure}
          </div>
        )}
      </div>

      {/* ── Control panel ─────────────────────────────────────────────────── */}
      <div className="w-64 border-l border-zinc-800 bg-zinc-900 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Mapping</p>
          <p className="font-semibold text-zinc-100 text-sm truncate">{songTitle}</p>
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
                  if (!isNaN(v)) jumpToMeasure(v)
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
              <button
                key={pos.measure}
                onClick={() => scrollToPosition(pos)}
                className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-zinc-800 transition-colors text-left"
              >
                <span className="text-zinc-100 font-medium">Measure {pos.measure}</span>
                <span className="text-zinc-500">p.{pos.page} · {Math.round(pos.yPercent * 100)}%</span>
              </button>
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
