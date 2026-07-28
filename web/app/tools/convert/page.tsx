"use client"

import { useState, useCallback } from "react"
import FileUploader from "@/components/FileUploader"
import DownloadButton from "@/components/DownloadButton"
import ErrorBoundary from "@/components/ErrorBoundary"
import { epubToPDF, pdfToEPUB } from "@/lib/convert-utils"
import { formatSize } from "@/lib/utils"

type ConvertDirection = "epub-to-pdf" | "pdf-to-epub"

function ConvertPageContent() {
  const [file, setFile] = useState<File | null>(null)
  const [direction, setDirection] = useState<ConvertDirection>("epub-to-pdf")
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<Blob | null>(null)
  const [resultName, setResultName] = useState("")
  const [error, setError] = useState("")

  const handleFileSelected = useCallback(
    (files: File[]) => {
      setFile(files[0])
      setResult(null)
      setError("")
      const ext = files[0].name.split(".").pop()?.toLowerCase()
      if (ext === "epub") setDirection("epub-to-pdf")
      else if (ext === "pdf") setDirection("pdf-to-epub")
    },
    []
  )

  const handleConvert = async () => {
    if (!file) return
    setProcessing(true)
    setResult(null)
    setError("")

    try {
      const outputName = file.name.replace(/\.[^.]+$/, direction === "epub-to-pdf" ? ".pdf" : ".epub")
      setResultName(outputName)

      if (direction === "epub-to-pdf") {
        const blob = await epubToPDF(file)
        setResult(blob)
      } else {
        const blob = await pdfToEPUB(file)
        setResult(blob)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">🔄 Convert Ebooks</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Convert between EPUB and PDF formats
      </p>

      <FileUploader accept={[".pdf", ".epub"]} onFilesSelected={handleFileSelected} />

      {file && (
        <div className="mt-4 space-y-4">
          <div className="p-4 rounded-lg border flex items-center gap-3"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
            <span className="text-lg">{file.name.endsWith(".pdf") ? "📄" : "📚"}</span>
            <div className="flex-1">
              <p className="font-medium">{file.name}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatSize(file.size)}</p>
            </div>
            <span className="text-sm font-medium px-3 py-1 rounded-lg" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)" }}>
              {direction === "epub-to-pdf" ? "EPUB → PDF" : "PDF → EPUB"}
            </span>
            <button onClick={() => { setFile(null); setResult(null); setError("") }}
              className="text-sm px-2 py-1 rounded" style={{ color: "var(--error)" }}>✕</button>
          </div>

          <div className="p-3 rounded-lg text-xs" style={{ backgroundColor: "var(--bg-card)" }}>
            <p style={{ color: "var(--text-secondary)" }}>
              {direction === "epub-to-pdf"
                ? "Converts EPUB text content to PDF. Output uses A4 pages with readable font sizing."
                : "Extracts text from PDF and creates a valid EPUB with chapter structure and table of contents."}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--error)" }}>
          {error}
        </div>
      )}

      {file && (
        <button
          onClick={handleConvert}
          disabled={processing}
          className="mt-6 w-full py-3 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: processing ? "var(--bg-card)" : "var(--accent)",
            color: processing ? "var(--text-secondary)" : "white",
          }}
        >
          {processing ? "Converting..." : `🔄 Convert to ${direction === "epub-to-pdf" ? "PDF" : "EPUB"}`}
        </button>
      )}

      {result && (
        <div className="mt-6">
          <div className="p-4 rounded-lg border"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
            <p className="font-medium mb-3">Conversion complete</p>
            <DownloadButton data={result} filename={resultName} label="Download" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConvertPage() {
  return (
    <ErrorBoundary>
      <ConvertPageContent />
    </ErrorBoundary>
  )
}
