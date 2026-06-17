export type PartName =
  | "soprano"
  | "alto"
  | "tenor"
  | "bass"
  | "soprano2"
  | "alto2"
  | "tenor2"
  | "bass2"
  | "piano"
  | "full_mix"

export interface TimeSigChange {
  measure: number       // 1-indexed measure where this time sig starts
  numerator: number     // beats per measure (e.g. 4)
  denominator: number   // beat note value (e.g. 4 = quarter note)
  clickNoteValue: number // what note value the click track uses (e.g. 4 = quarter, 8 = eighth)
}

export interface MeasurePosition {
  measure: number   // 1-indexed
  page: number      // 1-indexed
  yPercent: number  // 0–1, Y position as fraction of that page's rendered height
}

export interface BeatMapEntry {
  timestamp: number     // seconds from start of audio
  measure: number       // 1-indexed
  beat: number          // 1-indexed within measure
  timeSig: string       // e.g. "4/4"
}

export interface SongPart {
  name: PartName
  label: string         // display name e.g. "Soprano I"
  storageUrl: string    // Supabase Storage public URL
  color: string         // hex color for the channel strip
}

export interface Song {
  id: string
  title: string
  composer: string
  lyricist?: string
  arranger?: string
  voicing: string       // e.g. "SATB", "SSA", "TTBB"
  isAcappella: boolean
  parts: SongPart[]
  sheetMusicUrl: string // PDF
  clickTrackUrl?: string
  beatMap?: BeatMapEntry[]
  timeSigMap: TimeSigChange[]
  tempo?: number        // BPM (for display; beat map is authoritative)
  price: number         // cents
  published: boolean
  createdAt: string
  updatedAt: string
}

export interface Purchase {
  id: string
  userId: string
  songId: string
  createdAt: string
}
