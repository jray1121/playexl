"use client"
import { useState, useRef, useEffect, useMemo } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import type { BeatMapEntry, MeasurePosition } from "@/types"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

const PAGE_GAP = 24

// Two measures within this many px of each other are on the same line
const SAME_LINE_THRESHOLD_PX = 40

// Height of the highlight band as a fraction of page height — tune to match your score's staff height

// Where the incoming line lands on screen after scrolling (fraction of viewport)
const SCROLL_TARGET_FRAC = 0.20

// Easing scroll duration in ms
const SCROLL_DURATION = 600

interface ScrollTrigger {
  triggerTimestamp: number   // when to fire (last beat of the last measure on the line)
  targetMeasure: number      // first measure of the next line — scroll to show this
}

interface Props {
  url: string
  currentTime: number
  playing: boolean
  beatMap: BeatMapEntry[]
  measurePositions?: MeasurePosition[]
  zoom: number
  seekMeasure?: number | null  // set to a measure number to imperatively scroll there
}

export default function SheetMusicViewer({
  url,
  currentTime,
  playing,
  beatMap,
  measurePositions,
  zoom,
  seekMeasure,
}: Props) {
  const [numPages, setNumPages] = useState(0)
  const [pageDimensions, setPageDimensions] = useState<{ height: number }[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const pageDimRef = useRef<{ height: number }[]>([])
  const lastFiredTrigger = useRef<number>(-1)
  const scrollAnimRef = useRef<number>(0)
  // Always-current ref so effects can read currentTime without stale closures
  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime

  useEffect(() => { pageDimRef.current = pageDimensions }, [pageDimensions])

  const baseWidth = typeof window !== "undefined"
    ? Math.min(window.innerWidth * 0.58, 860)
    : 800
  const pageWidth = Math.round(baseWidth * zoom)

  function onPageRender(index: number, height: number) {
    setPageDimensions((prev) => {
      const next = [...prev]
      next[index] = { height }
      return next
    })
  }

  function posToY(pos: MeasurePosition, dims: { height: number }[]): number {
    let pageTop = 0
    for (let i = 0; i < pos.page - 1; i++) {
      pageTop += (dims[i]?.height ?? 0) + PAGE_GAP
    }
    return 24 + pageTop + pos.yPercent * (dims[pos.page - 1]?.height ?? 0)
  }

  function getMeasureY(measure: number, dims: { height: number }[]): number | null {
    if (!measurePositions?.length) return null
    const pos = measurePositions.find((p) => p.measure === measure)
      ?? [...measurePositions]
          .filter((p) => p.measure <= measure)
          .sort((a, b) => b.measure - a.measure)[0]
    return pos ? posToY(pos, dims) : null
  }

  // Build scroll triggers from measure positions + beat map
  // Only recalculated when positions or beat map change
  const scrollTriggers = useMemo<ScrollTrigger[]>(() => {
    if (!measurePositions?.length || !beatMap.length) return []

    const sorted = [...measurePositions].sort((a, b) => a.measure - b.measure)

    // Group measures into lines based on page + Y proximity
    // We'll use pixel Y once dims are loaded — but at memo time we only have yPercent.
    // Use page + yPercent proximity (0.05 = ~5% of page height) as a proxy.
    const LINE_Y_THRESHOLD = 0.06

    const lines: MeasurePosition[][] = []
    let currentLine: MeasurePosition[] = []

    for (const pos of sorted) {
      if (currentLine.length === 0) {
        currentLine.push(pos)
      } else {
        const prev = currentLine[currentLine.length - 1]
        const samePage = pos.page === prev.page
        const closeY = Math.abs(pos.yPercent - prev.yPercent) < LINE_Y_THRESHOLD
        if (samePage && closeY) {
          currentLine.push(pos)
        } else {
          lines.push(currentLine)
          currentLine = [pos]
        }
      }
    }
    if (currentLine.length) lines.push(currentLine)

    // For each line (except the last), build a trigger
    const triggers: ScrollTrigger[] = []

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i]
      const nextLine = lines[i + 1]

      // Last measure on this line
      const lastMeasureOnLine = Math.max(...line.map((p) => p.measure))

      // All beats belonging to that measure
      const beatsOnLastMeasure = beatMap.filter((b) => b.measure === lastMeasureOnLine)
      if (!beatsOnLastMeasure.length) continue

      // Last beat of that measure
      const lastBeat = beatsOnLastMeasure.reduce((a, b) => (a.beat > b.beat ? a : b))

      // First measure of the next line
      const firstMeasureNextLine = Math.min(...nextLine.map((p) => p.measure))

      triggers.push({
        triggerTimestamp: lastBeat.timestamp,
        targetMeasure: firstMeasureNextLine,
      })
    }

    return triggers
  }, [measurePositions, beatMap])

  // Smooth easing scroll
  function easeTo(targetScrollTop: number) {
    const container = containerRef.current
    if (!container) return
    cancelAnimationFrame(scrollAnimRef.current)

    const startScrollTop = container.scrollTop
    const distance = targetScrollTop - startScrollTop
    if (Math.abs(distance) < 2) return

    const startTime = performance.now()

    function step(now: number) {
      const el = containerRef.current
      if (!el) return
      const elapsed = now - startTime
      const progress = Math.min(elapsed / SCROLL_DURATION, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      el.scrollTop = startScrollTop + distance * eased
      if (progress < 1) scrollAnimRef.current = requestAnimationFrame(step)
    }

    scrollAnimRef.current = requestAnimationFrame(step)
  }

  // Watch currentTime and fire scroll when a trigger timestamp is passed
  useEffect(() => {
    if (!scrollTriggers.length) return

    const container = containerRef.current
    const dims = pageDimRef.current
    if (!container || !dims.length) return

    // Find the most recent trigger that should have fired by now
    const fired = scrollTriggers
      .filter((t) => currentTime >= t.triggerTimestamp)
      .sort((a, b) => b.triggerTimestamp - a.triggerTimestamp)[0]

    if (!fired) return
    if (fired.triggerTimestamp === lastFiredTrigger.current) return

    lastFiredTrigger.current = fired.triggerTimestamp

    const targetY = getMeasureY(fired.targetMeasure, dims)
    if (targetY === null) return

    const scrollTarget = Math.max(0, targetY - container.clientHeight * SCROLL_TARGET_FRAC)
    easeTo(scrollTarget)
  }, [currentTime, scrollTriggers])

  // Reset trigger memory when currentTime goes back near zero (song restart / rewind)
  useEffect(() => {
    if (currentTime < 1) lastFiredTrigger.current = -1
  }, [currentTime])

  // Scroll to measure when user jumps via transport
  useEffect(() => {
    if (seekMeasure == null) return
    const container = containerRef.current
    const dims = pageDimRef.current
    if (!container) return

    const targetY = dims.length ? getMeasureY(seekMeasure, dims) : null
    // Fall back to scrollTop 0 if we can't find the measure (e.g. measure 1 not mapped)
    const scrollTarget = targetY != null
      ? Math.max(0, targetY - container.clientHeight * SCROLL_TARGET_FRAC)
      : 0
    easeTo(scrollTarget)

    // Set lastFiredTrigger to the most recently passed trigger AT the seek position.
    // This prevents the currentTime effect from immediately re-firing triggers
    // that are already "behind" us after the seek.
    const t = currentTimeRef.current
    const lastPassed = scrollTriggers
      .filter((trig) => t >= trig.triggerTimestamp)
      .sort((a, b) => b.triggerTimestamp - a.triggerTimestamp)[0]
    lastFiredTrigger.current = lastPassed?.triggerTimestamp ?? -1
  }, [seekMeasure, scrollTriggers])

  useEffect(() => () => cancelAnimationFrame(scrollAnimRef.current), [])

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
            Loading score…
          </div>
        }
      >
        <div className="flex flex-col items-center py-6" style={{ gap: PAGE_GAP }}>
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i + 1}
              pageNumber={i + 1}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onRenderSuccess={(page) => onPageRender(i, page.height)}
              className="shadow-2xl rounded"
            />
          ))}
        </div>
      </Document>
    </div>
  )
}

function findBeatAtTime(beatMap: BeatMapEntry[], t: number): BeatMapEntry | null {
  if (!beatMap.length) return null
  let result = beatMap[0]
  for (const entry of beatMap) {
    if (entry.timestamp <= t) result = entry
    else break
  }
  return result
}
