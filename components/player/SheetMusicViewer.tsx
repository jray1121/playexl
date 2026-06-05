"use client"
import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

export default function SheetMusicViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>(0)

  return (
    <div className="flex flex-col items-center py-6 gap-6">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
            Loading score…
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i + 1}
            pageNumber={i + 1}
            width={Math.min(typeof window !== "undefined" ? window.innerWidth * 0.6 : 800, 800)}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-2xl rounded"
          />
        ))}
      </Document>
    </div>
  )
}
