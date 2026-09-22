"use client"
import { useEffect, useRef, useState } from "react"
import { Play, Pause, SkipBack, Download } from "lucide-react"
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
    allow_export?: boolean
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
  const [exportMode, setExportMode] = useState<"instant" | "live">("instant")
  const [exporting, setExporting] = useState(false)
  const [liveRecording, setLiveRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  // Volumes of full_mix/piano before the first solo — restored when all solos cleared
  const preSoloVolumesRef = useRef<Map<number, number>>(new Map())
  const inSoloSessionRef = useRef(false)

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

  function stop() {
    pause()
    offsetRef.current = 0
    setCurrentTime(0)
    if (beatMap.length) setCurrentBeat(timestampToBeat(beatMap, 0))
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

  // ── Export helpers ────────────────────────────────────────────────────────────

  async function exportInstantMP3() {
    const buffers = trackAudioRef.current
    if (!buffers.length) return
    setExporting(true)
    try {
      const sampleRate = audioCtxRef.current?.sampleRate ?? 44100
      const totalDuration = duration
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * totalDuration), sampleRate)

      const anySoloed = trackUIs.some((t) => t.soloed && t.part.name !== "click")

      buffers.forEach((audio, i) => {
        if (!audio?.buffer) return
        const ui = trackUIs[i]
        const isClick = ui.part.name === "click"
        const isPiano = ui.part.name === "piano"
        const isFullMix = ui.part.name === "full_mix"
        let shouldHear: boolean
        if (isClick) shouldHear = false // never export click track
        else if (isPiano || isFullMix) shouldHear = true
        else shouldHear = anySoloed ? ui.soloed : false
        if (!shouldHear) return

        const normGain = normGainsRef.current[i] ?? 1
        const gainNode = offlineCtx.createGain()
        gainNode.gain.value = ui.volume * normGain * masterVolume
        gainNode.connect(offlineCtx.destination)

        const source = offlineCtx.createBufferSource()
        source.buffer = audio.buffer
        source.connect(gainNode)
        source.start(0)
      })

      const rendered = await offlineCtx.startRendering()

      // Encode to MP3 using lamejs loaded via script tag
      // @ts-ignore
      const lame = (window as any).lamejs
      if (!lame) throw new Error("lamejs not loaded")

      const mp3enc = new lame.Mp3Encoder(2, sampleRate, 128)
      const left = rendered.getChannelData(0)
      const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left

      const CHUNK = 1152
      const mp3Data: Uint8Array[] = []
      for (let i = 0; i < left.length; i += CHUNK) {
        const l = toInt16(left.slice(i, i + CHUNK))
        const r = toInt16(right.slice(i, i + CHUNK))
        const chunk = mp3enc.encodeBuffer(l, r)
        if (chunk.length) mp3Data.push(chunk)
      }
      const end = mp3enc.flush()
      if (end.length) mp3Data.push(end)

      const blob = new Blob(mp3Data.map((d) => d.buffer as ArrayBuffer), { type: "audio/mp3" })
      triggerDownload(blob, `${song.title}.mp3`)
    } catch (err) {
      console.error("Export failed:", err)
    }
    setExporting(false)
  }

  function toInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  function startLiveRecording() {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const dest = ctx.createMediaStreamDestination()
    // Connect master output to recorder destination too
    masterGainRef.current?.connect(dest)

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm"
    const recorder = new MediaRecorder(dest.stream, { mimeType })
    recordedChunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      masterGainRef.current?.disconnect(dest)
      const blob = new Blob(recordedChunksRef.current, { type: mimeType })
      triggerDownload(blob, `${song.title}.webm`)
      setLiveRecording(false)
    }
    recorder.start()
    mediaRecorderRef.current = recorder
    setLiveRecording(true)
    // Start playback from beginning
    stop()
    setTimeout(() => startPlayback(0), 50)
  }

  function stopLiveRecording() {
    mediaRecorderRef.current?.stop()
    pause()
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
    setTrackUIs((prev) => {
      const wasAnySoloed = prev.some((t) => t.soloed && t.part.name !== "click")
      const clickingTrack = prev[index]
      const willBeSoloed = !clickingTrack.soloed
      const willBeAnySoloed = willBeSoloed || prev.some((t, i) => i !== index && t.soloed && t.part.name !== "click")

      // Entering a fresh solo session: save and drop background track volumes
      if (!wasAnySoloed && willBeAnySoloed && !inSoloSessionRef.current) {
        inSoloSessionRef.current = true
        preSoloVolumesRef.current = new Map()
        const updated = prev.map((t, i) => {
          if (t.part.name === "full_mix" || t.part.name === "piano") {
            preSoloVolumesRef.current.set(i, t.volume)
            return { ...t, volume: 0.5, soloed: i === index ? willBeSoloed : t.soloed }
          }
          return i === index ? { ...t, soloed: willBeSoloed } : t
        })
        return updated
      }

      // Clearing the last solo: restore saved volumes and end session
      if (wasAnySoloed && !willBeAnySoloed) {
        inSoloSessionRef.current = false
        const saved = preSoloVolumesRef.current
        preSoloVolumesRef.current = new Map()
        return prev.map((t, i) => {
          const restored = saved.get(i)
          return {
            ...t,
            soloed: i === index ? false : t.soloed,
            volume: restored !== undefined ? restored : t.volume,
          }
        })
      }

      // Mid-session solo change: just toggle, don't touch volumes
      return prev.map((t, i) => i === index ? { ...t, soloed: willBeSoloed } : t)
    })
  }

  function resetMixer() {
    inSoloSessionRef.current = false
    preSoloVolumesRef.current = new Map()
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
  const voicingColors = [voicingBaseColor]

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <p className="text-zinc-600 text-sm">Loading audio… {loadProgress}%</p>
        <div className="w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${loadProgress}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* lamejs for client-side MP3 encoding */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js" async />
      <div className="flex flex-1 min-h-0 relative">

        {/* ── Left control panel ─────────────────────────────────────────────── */}
        <div className="w-64 border-r-2 border-slate-300 bg-slate-200 flex flex-col shrink-0">

          {/* Song title + voicing + credits */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-200 shrink-0">
            <div ref={titleRef} className="w-full overflow-hidden mb-1">
              <h1 className="font-display font-bold text-zinc-900 tracking-tight leading-snug text-2xl">
                {song.title}
              </h1>
            </div>
            <p className="text-zinc-500 text-xs font-medium mb-2">
              {song.voicing}{song.is_acappella ? " · A Cappella" : " · w/ Piano"}
            </p>
            {creditLines.map((line) => (
              <p key={line} className="font-display text-zinc-600 text-sm leading-snug">{line}</p>
            ))}
          </div>

          {/* Click toggle — stays near top for Voctave */}
          {isVoctave && (
            <div className="px-4 pt-3 shrink-0">
              <button
                onClick={() => setClickOn((v) => !v)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold tracking-wide border-2 transition-all"
                style={clickOn
                  ? { background: `${voicingBaseColor}22`, borderColor: voicingBaseColor, color: voicingBaseColor, boxShadow: `0 0 8px ${voicingBaseColor}40` }
                  : { background: "transparent", borderColor: "#3f3f46", color: "#71717a" }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: clickOn ? voicingBaseColor : "#52525b" }} />
                Click {clickOn ? "On" : "Off"}
              </button>
            </div>
          )}

          {/* Spacer — pushes bottom controls down */}
          <div className="flex-1" />

          {/* Export — always shown for Voctave, opt-in for other voicings */}
          {(isVoctave || song.allow_export) && <div className="px-4 py-3 border-t border-slate-200 shrink-0 flex flex-col gap-2">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Export Mix</p>

            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-slate-300">
              <button
                onClick={() => setExportMode("instant")}
                className="flex-1 py-1.5 text-[11px] font-bold transition-colors"
                style={exportMode === "instant"
                  ? { background: voicingBaseColor, color: "#000" }
                  : { background: "transparent", color: "#71717a" }}
              >Instant</button>
              <button
                onClick={() => setExportMode("live")}
                className="flex-1 py-1.5 text-[11px] font-bold transition-colors border-l border-zinc-700"
                style={exportMode === "live"
                  ? { background: voicingBaseColor, color: "#000" }
                  : { background: "transparent", color: "#71717a" }}
              >Live</button>
            </div>

            <p className="text-[10px] text-zinc-500 leading-snug">
              {exportMode === "instant"
                ? "Exports MP3 at current fader levels instantly."
                : "Records in real-time so you can adjust faders. Saves as WAV."}
            </p>

            {exportMode === "instant" ? (
              <button
                onClick={exportInstantMP3}
                disabled={exporting || !loaded}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold tracking-wide border-2 transition-all disabled:opacity-40"
                style={{ background: `${voicingBaseColor}22`, borderColor: voicingBaseColor, color: voicingBaseColor }}
              >
                <Download size={13} />
                {exporting ? "Exporting…" : "Export MP3"}
              </button>
            ) : (
              <button
                onClick={liveRecording ? stopLiveRecording : startLiveRecording}
                disabled={!loaded}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold tracking-wide border-2 transition-all disabled:opacity-40"
                style={liveRecording
                  ? { background: "#ef444422", borderColor: "#ef4444", color: "#ef4444", boxShadow: "0 0 8px #ef444440" }
                  : { background: `${voicingBaseColor}22`, borderColor: voicingBaseColor, color: voicingBaseColor }}
              >
                <span className={`w-2 h-2 rounded-full ${liveRecording ? "animate-pulse" : ""}`}
                  style={{ background: liveRecording ? "#ef4444" : voicingBaseColor }} />
                {liveRecording ? "Stop & Save WAV" : "Record Live"}
              </button>
            )}
          </div>}

          {/* Bar : Beat */}
          {beatMap.length > 0 && (
            <div className="px-4 pb-2 shrink-0">
              <div className="flex items-stretch gap-0 bg-white border border-slate-200 rounded-lg overflow-hidden w-full">
                <div className="flex-1 flex flex-col items-center justify-center py-2">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Bar</p>
                  <p className="text-3xl font-black tabular-nums leading-none" style={{ color: voicingBaseColor, textShadow: `0 0 14px ${voicingBaseColor}99` }}>
                    {currentBeat ? String(currentBeat.measure).padStart(2, "0") : "—"}
                  </p>
                </div>
                <div className="flex items-center justify-center px-1 text-2xl font-black text-zinc-400">:</div>
                <div className="flex-1 flex flex-col items-center justify-center py-2">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Beat</p>
                  <p className="text-3xl font-black tabular-nums leading-none" style={{ color: voicingBaseColor, textShadow: `0 0 14px ${voicingBaseColor}99` }}>
                    {currentBeat ? currentBeat.beat : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Go to bar */}
          {beatMap.length > 0 && (
            <div className="px-4 pb-2 shrink-0 flex items-center gap-2">
              <span className="text-xs text-zinc-500 shrink-0">Go to bar</span>
              <input
                type="number"
                min={1}
                value={measureInput}
                onChange={(e) => setMeasureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const m = parseInt(measureInput)
                    if (!isNaN(m) && m > 0) jumpToMeasure(m)
                  }
                }}
                placeholder="1"
                className="w-14 bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm text-zinc-800 focus:outline-none focus:border-brand tabular-nums text-center"
              />
              <button
                onClick={() => { const m = parseInt(measureInput); if (!isNaN(m) && m > 0) jumpToMeasure(m) }}
                className="flex-1 py-1 rounded-lg text-xs font-bold tracking-wide border-2 transition-all"
                style={{ background: `${voicingBaseColor}22`, borderColor: voicingBaseColor, color: voicingBaseColor }}
              >Go</button>
            </div>
          )}

          {/* Auto-scroll + Zoom — pinned to bottom */}
          <div className="px-4 pb-3 shrink-0 flex flex-col gap-2">
            <button
              onClick={() => setAutoScroll((v) => !v)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold tracking-wide border-2 transition-all"
              style={autoScroll
                ? { background: `${voicingBaseColor}22`, borderColor: voicingBaseColor, color: voicingBaseColor, boxShadow: `0 0 8px ${voicingBaseColor}40` }
                : { background: "transparent", borderColor: "#3f3f46", color: "#71717a" }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: autoScroll ? voicingBaseColor : "#52525b" }} />
              Auto-scroll {autoScroll ? "On" : "Off"}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 shrink-0">Zoom</span>
              <button
                onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-zinc-700 flex items-center justify-center text-lg leading-none transition-colors"
              >−</button>
              <span className="text-xs text-zinc-600 w-9 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
                className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-zinc-700 flex items-center justify-center text-lg leading-none transition-colors"
              >+</button>
            </div>
          </div>
        </div>

        {/* ── PDF viewer ────────────────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-hidden min-h-0"
          style={{
            background: `#f4f4f5`,
          }}
        >
          <SheetMusicViewer
            url={song.sheet_music_url}
            currentTime={currentTime}
            playing={playing}
            beatMap={beatMap}
            measurePositions={song.measure_positions}
            zoom={zoom}
            seekMeasure={seekMeasure}
            autoScroll={autoScroll}
          />
        </div>

        {/* Floating transport bar — bottom center of the PDF area, overlaps sheet music */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-3 z-20 flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg"
          style={{
            width: "480px",
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(0,0,0,0.10)",
          }}
        >
          {/* Play */}
          <button
            onClick={() => { if (!playing) startPlayback(offsetRef.current) }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold tracking-wide border-2 transition-all"
            style={playing
              ? { background: voicingBaseColor, borderColor: voicingBaseColor, color: "#000" }
              : { background: `${voicingBaseColor}22`, borderColor: voicingBaseColor, color: voicingBaseColor }
            }
          >
            <Play size={13} style={{ fill: "currentColor" }} />
            Play
          </button>
          {/* Pause */}
          <button
            onClick={() => { if (playing) pause(); else if (currentTime > 0) startPlayback(offsetRef.current) }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold tracking-wide border-2 transition-all"
            style={!playing && currentTime > 0
              ? { background: "#f59e0b22", borderColor: "#f59e0b", color: "#f59e0b" }
              : { background: "transparent", borderColor: "#d4d4d8", color: "#71717a" }
            }
          >
            <Pause size={13} style={{ fill: "currentColor" }} />
            Pause
          </button>
          {/* Stop */}
          <button
            onClick={stop}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold tracking-wide border-2 transition-all"
            style={{ background: "transparent", borderColor: "#d4d4d8", color: "#71717a" }}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-current" />
            Stop
          </button>
        </div>

        {/* ── Mixer (right panel) ───────────────────────────────────────────────── */}
        <div className="w-64 border-l-2 border-slate-300 bg-slate-200 overflow-hidden flex flex-col shrink-0">
          {/* Mixer header */}
          <div className="pl-4 pr-5 pt-2.5 pb-2 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Mixer</p>
              <button
                onClick={resetMixer}
                className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-800 bg-slate-200 hover:bg-slate-300 px-2 py-0.5 rounded transition-colors"
              >Reset</button>
            </div>
          </div>

          {/* Full Mix pinned */}
          {trackUIs.filter((t) => t.part.name === "full_mix").map((track) => {
            const i = trackUIs.findIndex((t) => t.part.name === "full_mix")
            return (
              <div key="full_mix" className="shrink-0 h-16 border-b border-slate-300">
                <ChannelStrip track={track} index={0} baseColor={voicingBaseColor}
                  onVolumeChange={(v) => setVolume(i, v)} onSoloToggle={() => {}} hideSolo />
              </div>
            )
          })}

          {/* Scrollable strips */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {trackUIs
              .filter((track) => track.part.name !== "click" && track.part.name !== "full_mix")
              .map((track, rowIndex) => {
                const i = trackUIs.findIndex((t) => t.part.name === track.part.name)
                return (
                  <div key={track.part.name} className="shrink-0 h-16">
                    <ChannelStrip track={track} index={rowIndex} baseColor={stripColor(track.part.name)}
                      onVolumeChange={(v) => setVolume(i, v)} onSoloToggle={() => toggleSolo(i)} />
                  </div>
                )
              })}
          </div>

        </div>
      </div>

      {/* ── Seek bar (bottom) ─────────────────────────────────────────────────── */}
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
