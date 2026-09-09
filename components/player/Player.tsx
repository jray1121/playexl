"use client"
import { useEffect, useRef, useState } from "react"
import type { BeatMapEntry, MeasurePosition, SongPart } from "@/types"
import { buildCredits } from "@/lib/credits"
import { timestampToBeat, measureToTimestamp } from "@/lib/beatmap"
import { useFitFontSize } from "@/lib/useFitFontSize"
import { baseColorForVoicing, generatePartColors, VOCTAVE_MEMBER_COLORS } from "@/lib/voicingColors"
import Transport from "./Transport"
import ChannelStrip from "./ChannelStrip"
import dynamic from "next/dynamic"
const SheetMusicViewer = dynamic(() => import("./SheetMusicViewer"), { ssr: false })

/** Compute RMS loudness of an AudioBuffer (average across channels). */
function computeRMS(buffer: AudioBuffer): number {
  let sum = 0
  let count = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i]
      count++
    }
  }
  return count > 0 ? Math.sqrt(sum / count) : 1
}

// UI-only state per track (drives renders)
interface TrackUI {
  part: SongPart
  volume: number
  muted: boolean
  soloed: boolean
}

// Audio objects kept in refs — never in React state
interface TrackAudio {
  gainNode: GainNode
  buffer: AudioBuffer
  source: AudioBufferSourceNode | null
}

interface Props {
  song: {
    id: string
    title: string
    composer: string
    lyricist?: string
    arranger?: string
    voicing: string
    is_acappella: boolean
    parts: SongPart[]
    sheet_music_url: string
    beat_map?: BeatMapEntry[]
    measure_positions?: MeasurePosition[]
    time_sig_map: object[]
    tempo?: number
  }
}

export default function Player({ song }: Props) {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const compressorRef = useRef<DynamicsCompressorNode | null>(null)
  const normGainsRef = useRef<number[]>([]) // per-track normalization multipliers
  const trackAudioRef = useRef<TrackAudio[]>([])
  const startTimeRef = useRef<number>(0)
  const offsetRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const stoppedIntentionally = useRef<boolean>(false)

  const isVoctave = song.voicing === "Voctave"
  const VOCTAVE_MEMBERS = ["kate","tiffany","ashley","sarah","chrystal","ej","drew","jamey","kurt","johnny","karl"]
  const VOICE_PARTS = isVoctave
    ? VOCTAVE_MEMBERS
    : ["soprano","soprano2","alto","alto2","tenor","tenor2","bass","bass2"]
  const MAX_VISIBLE_TRACKS = isVoctave ? VOCTAVE_MEMBERS.length + 2 : VOICE_PARTS.length + 2 // +1 piano/click, +1 full_mix
  const [clickOn, setClickOn] = useState(false)
  const [trackUIs, setTrackUIs] = useState<TrackUI[]>(
    song.parts.map((part) => ({
      part,
      volume: 1,
      muted: false,
      soloed: false,
    }))
  )
  const [loaded, setLoaded] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentBeat, setCurrentBeat] = useState<BeatMapEntry | null>(null)
  const [measureInput, setMeasureInput] = useState("")
  const [zoom, setZoom] = useState(1.0)
  const [seekMeasure, setSeekMeasure] = useState<number | null>(null)
  const [masterVolume, setMasterVolume] = useState(1.0)
  const [autoScroll, setAutoScroll] = useState(true)

  const beatMap = song.beat_map ?? []

  const BEAT_DISPLAY_OFFSET = 0

  // ── Load buffers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ctx = new AudioContext()
    audioCtxRef.current = ctx

    // Master bus: track gains → compressor → master gain → output
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18   // start compressing at -18 dBFS
    compressor.knee.value = 6
    compressor.ratio.value = 4
    compressor.attack.value = 0.003
    compressor.release.value = 0.25
    compressorRef.current = compressor

    const masterGain = ctx.createGain()
    masterGain.gain.value = 1.0
    compressor.connect(masterGain)
    masterGain.connect(ctx.destination)
    masterGainRef.current = masterGain

    let completed = 0
    const total = song.parts.length

    const loadPromises = song.parts.map(async (part, i) => {
      try {
        const res = await fetch(part.storageUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const arrayBuffer = await res.arrayBuffer()
        const buffer = await ctx.decodeAudioData(arrayBuffer)

        const gainNode = ctx.createGain()
        gainNode.gain.value = 1
        gainNode.connect(compressor)
        trackAudioRef.current[i] = { gainNode, buffer, source: null }

        completed++
        setLoadProgress(Math.round((completed / total) * 100))
        if (completed === total) setLoaded(true)
        return buffer
      } catch (err) {
        console.error(`Failed to load track "${part.name}" (${part.storageUrl}):`, err)
        completed++
        setLoadProgress(Math.round((completed / total) * 100))
        if (completed === total) setLoaded(true)
        return null
      }
    })

    Promise.all(loadPromises).then((buffers) => {
      const valid = buffers.filter((b): b is AudioBuffer => b !== null)
      if (!valid.length) return
      setDuration(Math.max(...valid.map((b) => b.duration)))

      // Normalize each voice track to the same RMS target.
      // Skip full_mix and piano — they're already balanced mastered files.
      const TARGET_RMS = 0.08
      const norms = buffers.map((buf, i) => {
        if (!buf) return 1
        const partName = song.parts[i].name
        if (partName === "full_mix" || partName === "piano") return 1
        const rms = computeRMS(buf)
        return rms > 0 ? Math.min(TARGET_RMS / rms, 4) : 1
      })
      normGainsRef.current = norms
      trackAudioRef.current.forEach((audio, i) => {
        if (audio) audio.gainNode.gain.value = norms[i]
      })
    })

    return () => {
      cancelAnimationFrame(rafRef.current)
      stopAllSources()
      ctx.close()
    }
  }, [])

  // ── RAF ticker ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return
    function tick() {
      const ctx = audioCtxRef.current
      if (!ctx) return
      const t = offsetRef.current + (ctx.currentTime - startTimeRef.current)
      setCurrentTime(t)
      if (beatMap.length) setCurrentBeat(timestampToBeat(beatMap, Math.max(0, t - BEAT_DISPLAY_OFFSET)))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  // ── Gain updates when UI changes ─────────────────────────────────────────────
  useEffect(() => {
    const anySoloed = trackUIs.some((t) => t.soloed && t.part.name !== "click")
    trackUIs.forEach((ui, i) => {
      const audio = trackAudioRef.current[i]
      if (!audio) return
      const isPiano = ui.part.name === "piano"
      const isClick = ui.part.name === "click"
      const isFullMix = ui.part.name === "full_mix"
      let shouldHear: boolean
      if (isClick) {
        shouldHear = clickOn
      } else if (isPiano || isFullMix) {
        shouldHear = true  // full_mix always plays; fader controls the level
      } else {
        shouldHear = anySoloed ? ui.soloed : false
      }
      const normGain = normGainsRef.current[i] ?? 1
      audio.gainNode.gain.value = shouldHear ? ui.volume * normGain : 0
    })
  }, [trackUIs, clickOn])

  // ── Core audio helpers ───────────────────────────────────────────────────────

  function stopAllSources() {
    trackAudioRef.current.forEach((audio) => {
      if (!audio?.source) return
      try { audio.source.stop() } catch {}
      audio.source.onended = null
      audio.source = null
    })
  }

  function startPlayback(fromOffset: number) {
    const ctx = audioCtxRef.current
    if (!ctx) return

    // Stop everything synchronously first
    stoppedIntentionally.current = true
    stopAllSources()

    const startAt = ctx.currentTime + 0.05
    startTimeRef.current = startAt
    offsetRef.current = fromOffset
    stoppedIntentionally.current = false

    const anySoloed = trackUIs.some((t) => t.soloed && t.part.name !== "click")

    trackAudioRef.current.forEach((audio, i) => {
      if (!audio?.buffer) return
      const ui = trackUIs[i]
      const source = ctx.createBufferSource()
      source.buffer = audio.buffer
      source.connect(audio.gainNode)

      const isPiano = ui.part.name === "piano"
      const isClick = ui.part.name === "click"
      const isFullMix = ui.part.name === "full_mix"
      let shouldHear: boolean
      if (isClick) {
        shouldHear = clickOn
      } else if (isPiano || isFullMix) {
        shouldHear = true  // full_mix always plays; fader controls the level
      } else {
        shouldHear = anySoloed ? ui.soloed : false
      }
      const normGain = normGainsRef.current[i] ?? 1
      audio.gainNode.gain.value = shouldHear ? ui.volume * normGain : 0

      source.start(startAt, fromOffset)
      audio.source = source

      // Only the first track drives the "song ended" callback
      if (i === 0) {
        source.onended = () => {
          if (stoppedIntentionally.current) return
          setPlaying(false)
          setCurrentTime(0)
          offsetRef.current = 0
        }
      }
    })

    setPlaying(true)
  }

  function pause() {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const elapsed = offsetRef.current + (ctx.currentTime - startTimeRef.current)
    stoppedIntentionally.current = true
    stopAllSources()
    offsetRef.current = elapsed
    setPlaying(false)
  }

  function togglePlay() {
    if (playing) pause()
    else startPlayback(offsetRef.current)
  }

  function seek(seconds: number) {
    const wasPlaying = playing
    if (playing) pause()
    offsetRef.current = seconds
    setCurrentTime(seconds)
    if (beatMap.length) setCurrentBeat(timestampToBeat(beatMap, Math.max(0, seconds - BEAT_DISPLAY_OFFSET)))
    if (wasPlaying) startPlayback(seconds)
  }

  function jumpToMeasure(measure: number) {
    const ts = measureToTimestamp(beatMap, measure, 1)
    if (ts !== null) {
      seek(ts)
      setSeekMeasure(measure)
      // Clear after a tick so the same measure can be re-triggered
      setTimeout(() => setSeekMeasure(null), 100)
    }
  }

  // ── Master volume ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (masterGainRef.current) masterGainRef.current.gain.value = masterVolume
  }, [masterVolume])

  // ── Track UI controls ────────────────────────────────────────────────────────

  function setVolume(index: number, volume: number) {
    setTrackUIs((prev) => prev.map((t, i) => i === index ? { ...t, volume } : t))
  }

  function toggleMute(index: number) {
    setTrackUIs((prev) => prev.map((t, i) => i === index ? { ...t, muted: !t.muted } : t))
  }

  function toggleSolo(index: number) {
    setTrackUIs((prev) => prev.map((t, i) => i === index ? { ...t, soloed: !t.soloed } : t))
  }

  function resetMixer() {
    setTrackUIs((prev) => prev.map((t) => ({ ...t, volume: 1, muted: false, soloed: false })))
    setMasterVolume(1.0)
  }

  // ── Banner text sizing ───────────────────────────────────────────────────────
  // Title shrinks its font size to always fit on one line — long titles
  // never get truncated with an ellipsis. Voicing/credits now live in a
  // floating overlay on the PDF panel (see below), which just wraps
  // naturally since it isn't fighting the title for horizontal space.
  const creditLines = buildCredits({ composer: song.composer, lyricist: song.lyricist, arranger: song.arranger })

  const [titleRef, titleFontSize] = useFitFontSize(song.title, { min: 20, max: 44 })

  // This song's single Excelcia brand color for its voicing — ties the PDF
  // viewer background to the voicing instead of a fixed brand color. Spread
  // into a couple of shades for a touch of gradient richness, then subdued
  // with an alpha suffix so it blends into the dark background.
  const voicingBaseColor = baseColorForVoicing(song.voicing)
  // For Voctave, each member gets their own color; other voicings share one base color
  function stripColor(partName: string): string {
    if (isVoctave) {
      const member = partName.replace(/\d$/, "") // strip trailing digit if any
      return VOCTAVE_MEMBER_COLORS[member as keyof typeof VOCTAVE_MEMBER_COLORS] ?? voicingBaseColor
    }
    return voicingBaseColor
  }
  const voicingColors = generatePartColors(voicingBaseColor, 2).map((c) => `${c}66`)

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <p className="text-zinc-400 text-sm">Loading audio… {loadProgress}%</p>
        <div className="w-64 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${loadProgress}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Main area: PDF (with its own banner) + Mixer.
          overflow-visible so the song-info popover isn't clipped — the PDF
          viewer's own inner wrapper already handles its scroll containment.
          min-h-0 is required alongside overflow-visible: flex items with
          visible overflow get an automatic min-height based on content size,
          which would otherwise inflate this row beyond the viewport. */}
      <div className="flex flex-1 overflow-visible min-h-0">
        {/* Left column: title banner + PDF viewer. Same overflow-visible +
            min-h-0 pairing as above, for the same reason. */}
        <div className="flex-1 flex flex-col overflow-visible min-h-0">
          {/* Song info banner — title + small voicing line, full width.
              min-h accounts for the title's max font size (44px, leading-snug
              ≈ 68.5px with padding) plus the slim voicing row below it. */}
          <div className="relative z-30 w-full min-h-20 px-5 bg-zinc-900 shrink-0 flex flex-col items-center justify-center py-1">
            {/* Info icon + label — anchored to the left edge, absolutely positioned
                so it never competes with the title for space or affects centering. */}
            <div className="group absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <button
                className="w-5 h-5 rounded-full border border-zinc-600 text-zinc-500 group-hover:text-zinc-200 group-hover:border-zinc-400 flex items-center justify-center text-[11px] font-semibold transition-colors focus:outline-none shrink-0"
                aria-label="Writer credits"
              >
                i
              </button>
              <span className="text-[11px] font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors whitespace-nowrap">
                Writer Info
              </span>
              <div className="absolute top-full mt-2 left-0 z-20 w-64 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-lg px-3 py-2.5 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity text-center">
                {creditLines.map((line) => (
                  <p key={line} className="font-display text-zinc-300 text-xs leading-snug">
                    {line}
                  </p>
                ))}
              </div>
            </div>

            <div ref={titleRef} className="max-w-full overflow-hidden px-3">
              <h1
                className="font-display font-bold text-zinc-100 tracking-tight leading-snug whitespace-nowrap text-center"
                style={{ fontSize: titleFontSize }}
              >
                {song.title}
              </h1>
            </div>

            {/* Voicing — small, centered, directly under the title */}
            <p className="font-display text-zinc-300 text-xs font-medium leading-none -mt-0.5">
              {song.voicing} Voices{song.is_acappella ? " · A Cappella" : " · with Piano Accompaniment"}
            </p>
          </div>

          <div
            className="flex-1 overflow-hidden relative"
            style={{
              background:
                `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"), linear-gradient(to bottom, #18181b 0%, #18181b 10%, ${voicingColors.join(", ")})`,
            }}
          >
            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-lg px-3 py-1.5 shadow-lg">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-lg leading-none transition-colors"
              >−</button>
              <span className="text-xs text-zinc-400 w-9 text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
                className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-lg leading-none transition-colors"
              >+</button>
            </div>
            <SheetMusicViewer
              url={song.sheet_music_url}
              currentTime={currentTime}
              playing={playing}
              beatMap={beatMap}
              measurePositions={song.measure_positions}
              zoom={zoom}
              seekMeasure={seekMeasure}
              autoScroll={autoScroll}
              onAutoScrollChange={setAutoScroll}
            />
          </div>
        </div>

        <div className="w-72 border-l border-zinc-800 bg-zinc-950 overflow-hidden flex flex-col shrink-0">
          {/* Mixer header */}
          <div className="pl-4 pr-5 pt-2.5 pb-2 border-b border-zinc-800 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mixer</p>
              <button
                onClick={resetMixer}
                className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded transition-colors"
                title="Reset all faders to default"
              >
                Reset
              </button>
            </div>
            {/* Master volume — same label/fader/number layout as the track strips below */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-500">Master</span>
              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 h-5 flex items-center">
                  <div className="absolute inset-x-0 h-1 rounded-full bg-zinc-700/80" />
                  <div
                    className="absolute h-1 rounded-full bg-brand left-0"
                    style={{ width: `${(masterVolume / 2) * 100}%`, opacity: 0.75 }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.01}
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    style={{ zIndex: 10 }}
                  />
                  <div
                    className="absolute w-3.5 h-3.5 rounded-full bg-zinc-900 border-2 border-brand pointer-events-none"
                    style={{
                      left: `calc(${(masterVolume / 2) * 100}% - 7px)`,
                      boxShadow: "0 0 6px rgba(135,57,149,0.5)",
                    }}
                  />
                </div>
                <span className="text-[11px] font-mono w-8 text-right tabular-nums text-brand shrink-0">
                  {/* Display only — remapped so default (unity gain) shows 50 and
                      max (2x gain) shows 100. Underlying masterVolume range/behavior
                      is unchanged; this just keeps the number from reading above 100. */}
                  {Math.round(masterVolume * 50)}
                </span>
              </div>
            </div>
          </div>

          {/* Full Mix — pinned above the scroll area */}
          {trackUIs.filter((t) => t.part.name === "full_mix").map((track) => {
            const i = trackUIs.findIndex((t) => t.part.name === "full_mix")
            return (
              <div key="full_mix" className="shrink-0 border-b border-zinc-800" style={{ minHeight: "52px" }}>
                <ChannelStrip
                  track={track}
                  index={0}
                  baseColor={voicingBaseColor}
                  onVolumeChange={(v) => setVolume(i, v)}
                  onSoloToggle={() => {}}
                  hideSolo
                />
              </div>
            )
          })}

          {/* Channel strips — scrollable so any number of tracks fit */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {trackUIs
              .filter((track) => track.part.name !== "click" && track.part.name !== "full_mix")
              .map((track, rowIndex) => {
                const i = trackUIs.findIndex((t) => t.part.name === track.part.name)
                return (
                  <div
                    key={track.part.name}
                    className="shrink-0"
                    style={{ height: `${100 / Math.min(trackUIs.length, 8)}%`, minHeight: "52px" }}
                  >
                    <ChannelStrip
                      track={track}
                      index={rowIndex}
                      baseColor={stripColor(track.part.name)}
                      onVolumeChange={(v) => setVolume(i, v)}
                      onSoloToggle={() => toggleSolo(i)}
                    />
                  </div>
                )
              })}
            {/* Click track row — Voctave only */}
            {isVoctave && (
              <div
                className="shrink-0 flex items-center px-3 gap-3"
                style={{ minHeight: "52px", borderTop: "1px solid rgb(39,39,42)" }}
              >
                <button
                  onClick={() => setClickOn((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={clickOn
                    ? { borderColor: VOCTAVE_MEMBER_COLORS.click, color: VOCTAVE_MEMBER_COLORS.click, background: `${VOCTAVE_MEMBER_COLORS.click}22` }
                    : { borderColor: "#52525b", color: "#71717a" }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: clickOn ? VOCTAVE_MEMBER_COLORS.click : "#52525b" }}
                  />
                  Click {clickOn ? "On" : "Off"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transport */}
      <Transport
        playing={playing}
        currentTime={currentTime}
        duration={duration}
        currentBeat={currentBeat}
        beatMapReady={beatMap.length > 0}
        measureInput={measureInput}
        onMeasureInputChange={setMeasureInput}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onJumpToMeasure={jumpToMeasure}
      />
    </div>
  )
}
