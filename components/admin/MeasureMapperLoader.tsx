"use client"
import dynamic from "next/dynamic"
import type { MeasurePosition } from "@/types"

const MeasureMapper = dynamic(() => import("./MeasureMapper"), { ssr: false })

interface Props {
  songId: string
  songTitle: string
  pdfUrl: string
  initialPositions: MeasurePosition[]
  totalMeasures?: number
}

export default function MeasureMapperLoader(props: Props) {
  return <MeasureMapper {...props} />
}
