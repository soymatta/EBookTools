"use client"

import { useState, useCallback } from "react"
import FileUploader from "@/components/FileUploader"
import DownloadButton from "@/components/DownloadButton"
import { compressPDF } from "@/lib/pdf-utils"
import { compressEPUB } from "@/lib/epub-utils"

type OutputFormat = "original" | "pdf" | "epub"

interface ProcessedFile {
  name: string
  blob: Blob
  originalSize: number
  compressedSize: number
}

export default function CompressPage() {
  const [files, setFiles] = useState<File[]>([])
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("original")
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<ProcessedFile[]>([])

  const handleFilesSelected = useCallback((selected: File[]) => {
    setFiles(selected)
    setResults([])
  }, [])

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const processFiles = async () => {
    setProcessing(true)
    setResults([])
    setProgress({ current: 0, total: files.length })

    const processed: ProcessedFile[] = []

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length })
      const file = files[i]
      const ext = file.name.split(".").pop()?.toLowerCase()

      try {
        let blob: Blob
        const originalSize = file.size

        if (ext === "pdf") {
          blob = await compressPDF(file)
        } else if (ext === "epub") {
          blob = await compressEPUB(file)
        } else {
          continue
        }

        let outputName = file.name
        if (outputFormat === "pdf" && ext !== "pdf") {
          outputName = file.name.replace(/\.epub$/i, ".pdf")
        } else if (outputFormat === "epub" && ext !== "epub") {
          outputName = file.name.replace(/\.pdf$/i, ".epub")
        }

        processed.push({
          name: outputName,
          blob,
          originalSize,
          compressedSize: blob.size,
        })
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err)
      }
    }

    setResults(processed)
    setProcessing(false)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const getOutputBlob = (): Blob | null => {
    if (results.length === 0) return null
    if (results.length === 1) return results[0].blob

    // For multiple files, create a zip
    // TODO: implement JSZip for multi-file output
    return results[0].blob
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">📦 Compress Books</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Reduce file size without losing quality
      </p>

      <FileUploader
        accept={[".pdf", ".epub"]}
        multiple
        onFilesSelected={handleFilesSelected}
        disabled={processing}
      />

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg border"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {file.name.endsWith(".pdf") ? "📄" : "📚"}
                </span>
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {formatSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="text-sm px-2 py-1 rounded"
                style={{ color: "var(--error)" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-6">
          <label className="block text-sm font-medium mb-2">Output Format</label>
          <div className="flex gap-2">
            {(["original", "pdf", "epub"] as OutputFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setOutputFormat(fmt)}
                className="px-4 py-2 rounded-lg text-sm border transition-colors"
                style={{
                  backgroundColor: outputFormat === fmt ? "var(--accent)" : "var(--bg-card)",
                  borderColor: outputFormat === fmt ? "var(--accent)" : "var(--border)",
                  color: outputFormat === fmt ? "white" : "var(--text-primary)",
                }}
              >
                {fmt === "original" ? "Same as input" : fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && !processing && results.length === 0 && (
        <button
          onClick={processFiles}
          className="mt-6 w-full py-3 rounded-lg font-medium transition-colors"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          Compress {files.length} file{files.length > 1 ? "s" : ""}
        </button>
      )}

      {processing && (
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-1">
            <span>Processing...</span>
            <span>
              {progress.current} / {progress.total}
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--bg-card)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                backgroundColor: "var(--accent)",
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Results</h2>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div
                key={i}
                className="p-4 rounded-lg border"
                style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{r.name}</span>
                  <span
                    className="text-sm font-medium"
                    style={{
                      color:
                        r.compressedSize < r.originalSize ? "var(--success)" : "var(--error)",
                    }}
                  >
                    {r.compressedSize < r.originalSize ? "↓" : "↑"}{" "}
                    {formatSize(r.originalSize)} → {formatSize(r.compressedSize)}(
                    {Math.round((1 - r.compressedSize / r.originalSize) * 100)}%)
                  </span>
                </div>
                <DownloadButton data={r.blob} filename={r.name} label="Download" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
