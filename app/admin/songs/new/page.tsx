import SongForm from "@/components/admin/SongForm"

export default function NewSongPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">New Song</h1>
        <p className="text-zinc-400 text-sm mt-1">Upload audio stems, sheet music, and configure the beat map.</p>
      </div>
      <SongForm />
    </div>
  )
}
