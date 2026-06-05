"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Upload, Loader2, Music, FileText, Activity } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { SongPart, TimeSigChange, PartName } from "@/types"
import { detectOnsets, buildBeatMap } from "@/lib/beatmap"
import BeatMapEditor from "./BeatMapEditor"
import PartUploader from "./PartUploader"

const PART_OPTIONS: { name: PartName; label: string; color: string }[] = [
  { name: "soprano",       label: "Soprano I",    color: "#f472b6" },
  { name: "soprano2",      label: "Soprano II",   color: "#fb7185" },
  { name: "alto",          label: "Alto I",       color: "#a78bfa" },
  { name: "alto2",         label: "Alto II",      color: "#818cf8" },
  { name: "tenor",         label: "Tenor I",      color: "#38bdf8" },
  { name: "tenor2",        label: "Tenor II",     color: "#22d3ee" },
  { name: "bass",          label: "Bass I",       color: "#4ade80" },
  { name: "bass2",         label: "Bass II",      color: "#86efac" },
  { name: "piano",         label: "Piano",         color: "#f97316" },
  { name: "full_mix",      label: "Full Mix",      color: "#94a3b8" },
]

const INSTRUMENTAL_PARTS: PartName[] = ["piano"]

interface Props {
  initialData?: Partial<{
    id: string
    title: string
    composer: string
    arranger: string
    voicing: string
    isAcappella: boolean
    price: number
    published: boolean
    parts: SongPart[]
    timeSigMap: TimeSigChange[]
    sheetMusicUrl: string
    clickTrackUrl: string
    beatMap: object[]
    tempo: number
  }>
}

export default function SongForm({ initialData }: Props) {
  const router = useRouter()
  const isEdit = !!initialData?.id

  // Basic metadata
  const [title, setTitle] = useState(initialData?.title ?? "")
  const [composer, setComposer] = useState(initialData?.composer ?? "")
  const [arranger, setArranger] = useState(initialData?.arranger ?? "")
  const [voicing, setVoicing] = useState(initialData?.voicing ?? "SATB")
  const [isAcappella, setIsAcappella] = useState(initialData?.isAcappella ?? false)
  const [price, setPrice] = useState(((initialData?.price ?? 499) / 100).toString())
  const [published, setPublished] = useState(initialData?.published ?? false)
  const [tempo, setTempo] = useState(initialData?.tempo?.toString() ?? "")

  // Files
  const [sheetMusicFile, setSheetMusicFile] = useState<File | null>(null)
  const [sheetMusicUrl, setSheetMusicUrl] = useState(initialData?.sheetMusicUrl ?? "")
  const [clickFile, setClickFile] = useState<File | null>(null)
  const [clickUrl, setClickUrl] = useState(initialData?.clickTrackUrl ?? "")

  // Parts
  const [parts, setParts] = useState<(SongPart & { file?: File })[]>(
    initialData?.parts?.map((p) => ({ ...p })) ?? []
  )
  const [selectedPartNames, setSelectedPartNames] = useState<Set<PartName>>(
    new Set(initialData?.parts?.map((p) => p.name) ?? [])
  )

  // Beat map
  const [timeSigMap, setTimeSigMap] = useState<TimeSigChange[]>(
    initialData?.timeSigMap ?? [{ measure: 1, numerator: 4, denominator: 4, clickNoteValue: 4 }]
  )
  const [beatMap, setBeatMap] = useState<object[]>(initialData?.beatMap ?? [])
  const [analyzingClick, setAnalyzingClick] = useState(false)
  const [beatMapReady, setBeatMapReady] = useState((initialData?.beatMap?.length ?? 0) > 0)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // ── Part management ─────────────────────────────────────────────────────────

  function togglePart(name: PartName) {
    const next = new Set(selectedPartNames)
    if (next.has(name)) {
      next.delete(name)
      setParts((prev) => prev.filter((p) => p.name !== name))
    } else {
      next.add(name)
      const def = PART_OPTIONS.find((p) => p.name === name)!
      setParts((prev) => [
        ...prev,
        { name, label: def.label, color: def.color, storageUrl: "", file: undefined },
      ])
    }
    setSelectedPartNames(next)
  }

  function updatePartFile(name: PartName, file: File) {
    setParts((prev) =>
      prev.map((p) => (p.name === name ? { ...p, file } : p))
    )
  }

  function updatePartLabel(name: PartName, label: string) {
    setParts((prev) =>
      prev.map((p) => (p.name === name ? { ...p, label } : p))
    )
  }

  // ── Beat map analysis ────────────────────────────────────────────────────────

  async function analyzeClickTrack() {
    const file = clickFile
    if (!file) return
    setAnalyzingClick(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const audioCtx = new OfflineAudioContext(1, 1, 44100)
      const decoded = await audioCtx.decodeAudioData(arrayBuffer)
      const samples = decoded.getChannelData(0)
      const onsets = detectOnsets(samples, decoded.sampleRate, 0.15)
      const map = buildBeatMap(onsets, timeSigMap)
      setBeatMap(map)
      setBeatMapReady(true)
    } catch (e) {
      setError("Failed to analyze click track. Check the file and try again.")
    } finally {
      setAnalyzingClick(false)
    }
  }

  // ── Upload helpers ───────────────────────────────────────────────────────────

  async function uploadFile(file: File, bucket: string, path: string): Promise<string> {
    const supabase = createClient()
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) throw new Error(error.message)
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")

    try {
      const supabase = createClient()
      const songId = initialData?.id ?? crypto.randomUUID()

      // Upload sheet music
      let finalSheetUrl = sheetMusicUrl
      if (sheetMusicFile) {
        finalSheetUrl = await uploadFile(sheetMusicFile, "sheet-music", `${songId}/score.pdf`)
      }

      // Upload click track
      let finalClickUrl = clickUrl
      if (clickFile) {
        finalClickUrl = await uploadFile(clickFile, "click-tracks", `${songId}/click.${clickFile.name.split(".").pop()}`)
      }

      // Upload part audio files
      const finalParts: SongPart[] = []
      for (const part of parts) {
        let storageUrl = part.storageUrl
        if (part.file) {
          const ext = part.file.name.split(".").pop()
          storageUrl = await uploadFile(part.file, "audio-stems", `${songId}/${part.name}.${ext}`)
        }
        finalParts.push({ name: part.name, label: part.label, storageUrl, color: part.color })
      }

      const payload = {
        id: songId,
        title,
        composer,
        arranger: arranger || null,
        voicing,
        is_acappella: isAcappella,
        price: Math.round(parseFloat(price) * 100),
        published,
        tempo: tempo ? parseInt(tempo) : null,
        parts: finalParts,
        sheet_music_url: finalSheetUrl,
        click_track_url: finalClickUrl || null,
        beat_map: beatMap.length ? beatMap : null,
        time_sig_map: timeSigMap,
        updated_at: new Date().toISOString(),
        ...(isEdit ? {} : { created_at: new Date().toISOString() }),
      }

      const { error: dbError } = await supabase
        .from("songs")
        .upsert(payload)

      if (dbError) throw new Error(dbError.message)

      router.push("/admin/songs")
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* ── Metadata ── */}
      <Section title="Song Details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Composer" required>
            <input value={composer} onChange={(e) => setComposer(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Arranger">
            <input value={arranger} onChange={(e) => setArranger(e.target.value)} className={inputCls} placeholder="Optional" />
          </Field>
          <Field label="Voicing">
            <select value={voicing} onChange={(e) => setVoicing(e.target.value)} className={inputCls}>
              {["SATB", "SSA", "SAB", "TTBB", "SSAA", "SSAATB", "Unison", "Two-part"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Tempo (BPM)">
            <input
              type="number"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              className={inputCls}
              placeholder="e.g. 120"
            />
          </Field>
          <Field label="Price (USD)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className={cn(inputCls, "pl-7")}
              />
            </div>
          </Field>
        </div>
        <div className="flex gap-6 mt-2">
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isAcappella}
              onChange={(e) => {
                setIsAcappella(e.target.checked)
                if (e.target.checked) {
                  setParts((prev) => prev.filter((p) => !INSTRUMENTAL_PARTS.includes(p.name)))
                  setSelectedPartNames((prev) => {
                    const next = new Set(prev)
                    INSTRUMENTAL_PARTS.forEach((n) => next.delete(n))
                    return next
                  })
                }
              }}
              className="accent-amber-400 w-4 h-4"
            />
            A cappella (no accompaniment track)
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="accent-amber-400 w-4 h-4"
            />
            Publish immediately
          </label>
        </div>
      </Section>

      {/* ── Sheet Music ── */}
      <Section title="Sheet Music (PDF)">
        <FileDropZone
          accept=".pdf"
          label="Drop PDF score here or click to browse"
          icon={<FileText size={24} className="text-zinc-500" />}
          currentUrl={sheetMusicUrl}
          currentLabel={sheetMusicUrl ? "Current score on file" : undefined}
          onChange={setSheetMusicFile}
        />
      </Section>

      {/* ── Voice Parts ── */}
      <Section title="Voice Parts & Audio Stems">
        <p className="text-zinc-400 text-sm mb-4">Select the parts this song uses, then upload the isolated audio stem for each.</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {PART_OPTIONS.filter((p) => !isAcappella || !INSTRUMENTAL_PARTS.includes(p.name)).map(({ name, label, color }) => (
            <button
              key={name}
              type="button"
              onClick={() => togglePart(name)}
              style={selectedPartNames.has(name) ? { borderColor: color, color } : {}}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                selectedPartNames.has(name)
                  ? "bg-current/10"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {parts.length > 0 && (
          <div className="space-y-3">
            {parts.map((part) => (
              <PartUploader
                key={part.name}
                part={part}
                onFileChange={(file) => updatePartFile(part.name, file)}
                onLabelChange={(label) => updatePartLabel(part.name, label)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ── Click Track & Beat Map ── */}
      <Section title="Click Track & Beat Map">
        <p className="text-zinc-400 text-sm mb-4">
          Upload the click track, define time signature changes, then analyze to generate the beat map
          used for measure:beat sync in the player.
        </p>

        <FileDropZone
          accept="audio/*"
          label="Drop click track audio here or click to browse"
          icon={<Music size={24} className="text-zinc-500" />}
          currentUrl={clickUrl}
          currentLabel={clickUrl ? "Click track on file" : undefined}
          onChange={setClickFile}
        />

        <div className="mt-6">
          <BeatMapEditor timeSigMap={timeSigMap} onChange={setTimeSigMap} />
        </div>

        {(clickFile || clickUrl) && (
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={analyzeClickTrack}
              disabled={analyzingClick || !clickFile}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {analyzingClick ? <Loader2 size={15} className="animate-spin" /> : <Activity size={15} />}
              {analyzingClick ? "Analyzing…" : clickFile ? "Analyze Click Track" : "Upload new click to re-analyze"}
            </button>
            {beatMapReady && (
              <span className="text-green-400 text-sm font-medium">
                ✓ Beat map ready ({beatMap.length} beats detected)
              </span>
            )}
          </div>
        )}
      </Section>

      {/* ── Actions ── */}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-900 font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Song"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-zinc-400 hover:text-zinc-100 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-400 text-sm"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <h2 className="font-semibold text-zinc-100 text-base">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1">
        {label}{required && <span className="text-amber-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function FileDropZone({
  accept,
  label,
  icon,
  currentUrl,
  currentLabel,
  onChange,
}: {
  accept: string
  label: string
  icon: React.ReactNode
  currentUrl?: string
  currentLabel?: string
  onChange: (file: File) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string>()
  const ref = useRef<HTMLInputElement>(null)

  function handle(file: File) {
    setFileName(file.name)
    onChange(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f) }}
      onClick={() => ref.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors",
        dragging ? "border-amber-400 bg-amber-400/5" : "border-zinc-700 hover:border-zinc-500"
      )}
    >
      {icon}
      <p className="text-sm text-zinc-400">{fileName ?? currentLabel ?? label}</p>
      {(fileName || currentLabel) && (
        <p className="text-xs text-zinc-600">{label}</p>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f) }} />
    </div>
  )
}
