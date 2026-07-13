"use client"

import { useState, useCallback } from "react"
import FileUploader from "@/components/FileUploader"
import DownloadButton from "@/components/DownloadButton"

type ConvertDirection = "epub-to-pdf" | "pdf-to-epub"

export default function ConvertPage() {
  const [file, setFile] = useState<File | null>(null)
  const [direction, setDirection] = useState<ConvertDirection>("epub-to-pdf")
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<Blob | null>(null)
  const [resultName, setResultName] = useState("")

  const handleFileSelected = useCallback(
    (files: File[]) => {
      setFile(files[0])
      setResult(null)
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

    try {
      // TODO: implement actual conversion
      const outputName = file.name.replace(/\.[^.]+$/, direction === "epub-to-pdf" ? ".pdf" : ".epub")
      setResultName(outputName)

      // Placeholder - will be implemented with actual conversion logic
      await new Promise((r) => setTimeout(r, 1000))
      setResult(new Blob(["Conversion not yet implemented"], { type: "text/plain" }))
    } catch (err) {
      console.error("Conversion error:", err)
    } finally {
      setProcessing(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">🔄 EPUB ↔ PDF</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Convert between EPUB and PDF formats
      </p>

      <FileUploader accept={[".pdf", ".epub"]} onFilesSelected={handleFileSelected} />

      {file && (
        <div className="mt-4 space-y-4">
          <div
            className="p-4 rounded-lg border flex items-center gap-3"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <span className="text-lg">{file.name.endsWith(".pdf") ? "📄" : "📚"}</span>
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {formatSize(file.size)}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Conversion Direction</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDirection("epub-to-pdf")}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  backgroundColor: direction === "epub-to-pdf" ? "var(--accent)" : "var(--bg-card)",
                  borderColor: direction === "epub-to-pdf" ? "var(--accent)" : "var(--border)",
                  color: direction === "epub-to-pdf" ? "white" : "var(--text-primary)",
                }}
              >
                📚 EPUB → 📄 PDF
              </button>
              <button
                onClick={() => setDirection("pdf-to-epub")}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  backgroundColor: direction === "pdf-to-epub" ? "var(--accent)" : "var(--bg-card)",
                  borderColor: direction === "pdf-to-epub" ? "var(--accent)" : "var(--border)",
                  color: direction === "pdf-to-epub" ? "white" : "var(--text-primary)",
                }}
              >
                📄 PDF → 📚 EPUB
              </button>
            </div>
          </div>
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
          {processing ? "Converting..." : "Convert"}
        </button>
      )}

      {result && (
        <div className="mt-6">
          <div
            className="p-4 rounded-lg border"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <p className="font-medium mb-3">✅ Conversion complete</p>
            <DownloadButton data={result} filename={resultName} label="Download" />
          </div>
        </div>
      )}
    </div>
  )
}
