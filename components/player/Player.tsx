"use client"
import { useEffect, useRef, useState } from "react"
import type { BeatMapEntry, SongPart } from "@/types"
import { timestampToBeat, measureToTimestamp } from "@/lib/beatmap"
import Transport from "./Transport"
import ChannelStrip from "./ChannelStrip"
import SheetMusicViewer from "./SheetMusicViewer"

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
    arranger?: string
    voicing: string
    parts: SongPart[]
    sheet_music_url: string
    beat_map?: BeatMapEntry[]
    time_sig_map: object[]
    tempo?: number
  }
}

export default function Player({ song }: Props) {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const trackAudioRef = useRef<TrackAudio[]>([])   // sources/gains live here
  const startTimeRef = useRef<number>(0)            // AudioContext.currentTime at play start
  const offsetRef = useRef<number>(0)               // song position when playback started
  const rafRef = useRef<number>(0)
  const stoppedIntentionally = useRef<boolean>(false)

  const [trackUIs, setTrackUIs] = useState<TrackUI[]>(
    song.parts.map((part) => ({ part, volume: 1, muted: false, soloed: false }))
  )
  const [loaded, setLoaded] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentBeat, setCurrentBeat] = useState<BeatMapEntry | null>(null)
  const [measureInput, setMeasureInput] = useState("")

  const beatMap = song.beat_map ?? []

  // How many seconds to delay the beat display relative to audio playback.
  // Increase if the counter flips too early; decrease if it flips too late.
  const BEAT_DISPLAY_OFFSET = 0.33  // 330ms

  // ── Load buffers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    let completed = 0
    const total = song.parts.length

    const loadPromises = song.parts.map(async (part, i) => {
      const res = await fetch(part.storageUrl)
      const arrayBuffer = await res.arrayBuffer()
      const buffer = await ctx.decodeAudioData(arrayBuffer)

      const gainNode = ctx.createGain()
      gainNode.gain.value = 1
      gainNode.connect(ctx.destination)
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
      const shouldHear = !ui.muted && (!anySoloed || ui.soloed)
      audio.gainNode.gain.value = shouldHear ? ui.volume : 0
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

      const shouldHear = !ui.muted && (!anySoloed || ui.soloed)
      audio.gainNode.gain.value = shouldHear ? ui.volume : 0

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
    if (ts !== null) seek(ts)
  }

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
          <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${loadProgress}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <h1 className="font-bold text-zinc-100">{song.title}</h1>
        <p className="text-zinc-400 text-xs mt-0.5">
          {song.composer}{song.arranger ? ` · arr. ${song.arranger}` : ""} · {song.voicing}
        </p>
      </div>

      {/* Main area: PDF + Mixer */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto bg-zinc-950">
          <SheetMusicViewer url={song.sheet_music_url} />
        </div>

        <div className="w-72 border-l border-zinc-800 bg-zinc-900 overflow-y-auto flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-zinc-800">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Mixer</p>
          </div>
          <div className="flex-1 divide-y divide-zinc-800/50">
            {trackUIs.map((track, i) => (
              <ChannelStrip
                key={track.part.name}
                track={track}
                onVolumeChange={(v) => setVolume(i, v)}
                onMuteToggle={() => toggleMute(i)}
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
