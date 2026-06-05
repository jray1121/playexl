"use client"
import { useRef, useState } from "react"
import { Upload, CheckCircle } from "lucide-react"
import type { SongPart } from "@/types"
import { cn } from "@/lib/utils"

interface Props {
  part: SongPart & { file?: File }
  onFileChange: (file: File) => void
  onLabelChange: (label: string) => void
}

export default function PartUploader({ part, onFileChange, onLabelChange }: Props) {
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const hasFile = !!part.file || !!part.storageUrl

  return (
    <div
      className="flex items-center gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3"
      style={{ borderLeftColor: part.color, borderLeftWidth: 3 }}
    >
      {/* Label */}
      <input
        value={part.label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="bg-transparent text-sm font-medium text-zinc-100 focus:outline-none w-32 shrink-0"
      />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFileChange(f) }}
        onClick={() => ref.current?.click()}
        className={cn(
          "flex-1 flex items-center gap-2 border border-dashed rounded-lg px-3 py-2 cursor-pointer transition-colors text-sm",
          dragging ? "border-amber-400 bg-amber-400/5 text-amber-400" : "border-zinc-600 text-zinc-400 hover:border-zinc-400"
        )}
      >
        {hasFile ? (
          <>
            <CheckCircle size={14} className="text-green-400 shrink-0" />
            <span className="text-green-400 truncate">
              {part.file?.name ?? "File uploaded"}
            </span>
          </>
        ) : (
          <>
            <Upload size={14} className="shrink-0" />
            <span>Drop audio stem or click to browse</span>
          </>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChange(f) }}
      />
    </div>
  )
}
