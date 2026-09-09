import { createClient } from "@/lib/supabase/server"
import StoreClient from "@/components/admin/StoreClient"

export default async function StorePage() {
  const supabase = await createClient()
  const { data: songs } = await supabase
    .from("songs")
    .select("id, title, composer, voicing, sku")
    .eq("published", true)
    .order("title")

  return <StoreClient songs={songs ?? []} />
}
