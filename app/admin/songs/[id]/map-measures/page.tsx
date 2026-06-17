import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import MeasureMapperLoader from "@/components/admin/MeasureMapperLoader"

export default async function MapMeasuresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: song } = await supabase
    .from("songs")
    .select("id, title, sheet_music_url, measure_positions, beat_map")
    .eq("id", id)
    .single()

  if (!song) notFound()

  const totalMeasures = song.beat_map
    ? Math.max(...(song.beat_map as { measure: number }[]).map((b) => b.measure))
    : undefined

  return (
    <MeasureMapperLoader
      songId={song.id}
      songTitle={song.title}
      pdfUrl={song.sheet_music_url}
      initialPositions={song.measure_positions ?? []}
      totalMeasures={totalMeasures}
    />
  )
}
