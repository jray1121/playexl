"use client"
import { useEffect, useRef, useState } from "react"
import type { BeatMapEntry, MeasurePosition, SongPart } from "@/types"
import { buildCredits } from "@/lib/credits"
import { timestampToBeat, measureToTimestamp } from "@/lib/beatmap"
import Transport from "./Transport"
import ChannelStrip from "./ChannelStrip"
import dynamic from "next/dynamic"
const SheetMusicViewer = dynamic(() => import("./SheetMusicViewer"), { ssr: false })

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
  const trackAudioRef = useRef<TrackAudio[]>([])
  const startTimeRef = useRef<number>(0)
  const offsetRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const stoppedIntentionally = useRef<boolean>(false)

  const VOICE_PARTS = ["soprano","soprano2","alto","alto2","tenor","tenor2","bass","bass2"]
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

  const beatMap = song.beat_map ?? []

  // How many seconds to delay the beat display relative to audio playback.
  // Increase if the counter flips too early; decrease if it flips too late.
  const BEAT_DISPLAY_OFFSET = 0.33  // 330ms

  // ── Load buffers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const masterGain = ctx.createGain()
    masterGain.gain.value = 1.0
    masterGain.connect(ctx.destination)
    masterGainRef.current = masterGain
    let completed = 0
    const total = song.parts.length

    const loadPromises = song.parts.map(async (part, i) => {
      const res = await fetch(part.storageUrl)
      const arrayBuffer = await res.arrayBuffer()
      const buffer = await ctx.decodeAudioData(arrayBuffer)

      const gainNode = ctx.createGain()
      gainNode.gain.value = 1
      gainNode.connect(masterGain)
      trackAudioRef.current[i] = { gainNode, buffer, source: null }

      completed++
      setLoadProgress(Math.round((completed / total) * 100))
      if (completed === total) setLoaded(true)
      return buffer
    })

    Promise.all(loadPromises).then((buffers) => {
      setDuration(Math.max(...buffers.map((b) => b.duration)))
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
    const anySoloed = trackUIs.some((t) => t.soloed)
    trackUIs.forEach((ui, i) => {
      const audio = trackAudioRef.current[i]
      if (!audio) return
      const isPiano = ui.part.name === "piano"
      const isFullMix = ui.part.name === "full_mix"
      const isVoice = VOICE_PARTS.includes(ui.part.name)
      let shouldHear: boolean
      if (isPiano) {
        shouldHear = true
      } else if (isFullMix) {
        shouldHear = !anySoloed
      } else {
        shouldHear = anySoloed ? ui.soloed : false
      }
      // Voice parts always get a hidden 2x boost on top of the fader position
      const gain = isVoice ? ui.volume * 2.0 : ui.volume
      audio.gainNode.gain.value = shouldHear ? gain : 0
    })
  }, [trackUIs])

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

    const anySoloed = trackUIs.some((t) => t.soloed)

    trackAudioRef.current.forEach((audio, i) => {
      if (!audio?.buffer) return
      const ui = trackUIs[i]
      const source = ctx.createBufferSource()
      source.buffer = audio.buffer
      source.connect(audio.gainNode)

      const isPiano = ui.part.name === "piano"
      const isFullMix = ui.part.name === "full_mix"
      const isVoice = VOICE_PARTS.includes(ui.part.name)
      let shouldHear: boolean
      if (isPiano) {
        shouldHear = true
      } else if (isFullMix) {
        shouldHear = !anySoloed
      } else {
        shouldHear = anySoloed ? ui.soloed : false
      }
      // Voice parts always get a hidden 2x boost on top of the fader position
      const gain = isVoice ? ui.volume * 2.0 : ui.volume
      audio.gainNode.gain.value = shouldHear ? gain : 0

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
      {/* Song info banner — two compact rows */}
      <div className="w-full px-6 pt-2 pb-1.5 border-b border-zinc-800 bg-zinc-900/70 shrink-0 text-center">
        <div className="flex items-center justify-center gap-2.5 flex-wrap leading-tight">
          <h1 className="font-bold text-xl text-zinc-100 tracking-tight leading-tight">{song.title}</h1>
          <span className="text-zinc-600 text-sm">·</span>
          <span className="text-zinc-300 text-sm">
            {song.is_acappella
              ? `a cappella ${song.voicing}`
              : `${song.voicing} with Piano`}
          </span>
        </div>
        <p className="text-zinc-500 text-xs mt-0.5 leading-tight">
          {buildCredits({ composer: song.composer, lyricist: song.lyricist, arranger: song.arranger }).join("  ·  ")}
        </p>
      </div>


      {/* Main area: PDF + Mixer */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden bg-zinc-950 relative">
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
          />
        </div>

        <div className="w-72 border-l border-zinc-800 bg-zinc-900 overflow-y-auto flex flex-col shrink-0">
          {/* Mixer header + master volume */}
          <div className="pl-4 pr-5 pt-4 pb-3 border-b border-zinc-800 space-y-3">
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Mixer</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">Master Volume</span>
                <span className="text-xs font-mono text-brand tabular-nums">
                  {Math.round(masterVolume * 100)}%
                </span>
              </div>
              <div className="relative flex items-center h-5">
                <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-700" />
                <div
                  className="absolute h-1.5 rounded-full bg-brand left-0"
                  style={{ width: `${(masterVolume / 2) * 100}%`, opacity: 0.8 }}
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
                  className="absolute w-4 h-4 rounded-full bg-zinc-900 border-2 border-brand shadow-md pointer-events-none"
                  style={{
                    left: `calc(${(masterVolume / 2) * 100}% - 8px)`,
                    boxShadow: "0 0 8px rgba(135,57,149,0.4)",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex-1 divide-y divide-zinc-800/50">
            {trackUIs.map((track, i) => (
              <ChannelStrip
                key={track.part.name}
                track={track}
                onVolumeChange={(v) => setVolume(i, v)}
                onSoloToggle={() => toggleSolo(i)}
              />
            ))}
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
