"use client"

import { useState, useCallback } from "react"
import FileUploader from "@/components/FileUploader"
import DownloadButton from "@/components/DownloadButton"
import { compressPDF, type CompressionLevel, COMPRESSION_LEVELS } from "@/lib/pdf-utils"
import { compressEPUB } from "@/lib/epub-utils"

interface ProcessedFile {
  name: string
  blob: Blob
  originalSize: number
  compressedSize: number
  error?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

export default function CompressPage() {
  const [files, setFiles] = useState<File[]>([])
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>("normal")
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
          blob = await compressPDF(file, compressionLevel)
        } else if (ext === "epub") {
          blob = await compressEPUB(file, compressionLevel)
        } else {
          processed.push({ name: file.name, blob: file, originalSize, compressedSize: originalSize, error: "Unsupported format" })
          continue
        }

        processed.push({
          name: file.name,
          blob,
          originalSize,
          compressedSize: blob.size,
        })
      } catch (err) {
        processed.push({
          name: file.name,
          blob: file,
          originalSize: file.size,
          compressedSize: file.size,
          error: err instanceof Error ? err.message : "Unknown error",
        })
      }
    }

    setResults(processed)
    setProcessing(false)
  }

  const successfulResults = results.filter(r => !r.error)
  const failedResults = results.filter(r => r.error)

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
              key={file.name + file.size}
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
                aria-label={`Remove ${file.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Compression Level</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(COMPRESSION_LEVELS) as CompressionLevel[]).map((level) => {
                const config = COMPRESSION_LEVELS[level]
                const isActive = compressionLevel === level
                return (
                  <button
                    key={level}
                    onClick={() => setCompressionLevel(level)}
                    className="p-3 rounded-lg border text-left transition-all"
                    style={{
                      backgroundColor: isActive ? "var(--accent)" : "var(--bg-card)",
                      borderColor: isActive ? "var(--accent)" : "var(--border)",
                      color: isActive ? "white" : "var(--text-primary)",
                    }}
                  >
                    <div className="text-sm font-semibold mb-1">{config.label}</div>
                    <div
                      className="text-xs leading-relaxed"
                      style={{ color: isActive ? "rgba(255,255,255,0.8)" : "var(--text-secondary)" }}
                    >
                      {config.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-3 rounded-lg text-xs" style={{ backgroundColor: "var(--bg-card)" }}>
            <p style={{ color: "var(--text-secondary)" }}>
              <strong>EPUB:</strong> Removes junk files (.DS_Store, Thumbs.db), optimizes images, repacks with better compression.
              {" "}<strong>PDF:</strong> Rebuilds object streams and removes duplicate objects. Both are lossless — no quality loss.
            </p>
          </div>
        </div>
      )}

      {files.length > 0 && !processing && results.length === 0 && (
        <button
          onClick={processFiles}
          className="mt-6 w-full py-3 rounded-lg font-medium"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          Compress {files.length} file{files.length > 1 ? "s" : ""}
        </button>
      )}

      {processing && (
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-1">
            <span>Processing...</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-card)" }}>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Results</h2>
            {successfulResults.length > 1 && (
              <DownloadButton
                data={successfulResults.map(r => r.blob)}
                filename={successfulResults.map(r => r.name)}
                label={`Download All (${successfulResults.length})`}
              />
            )}
          </div>

          <div className="space-y-3">
            {successfulResults.map((r) => {
              const pct = Math.round((1 - r.compressedSize / r.originalSize) * 100)
              const isSmaller = r.compressedSize < r.originalSize
              const isSame = Math.abs(r.compressedSize - r.originalSize) < 1024

              return (
                <div
                  key={r.name}
                  className="p-4 rounded-lg border"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{r.name}</span>
                    <span
                      className="text-sm font-medium"
                      style={{
                        color: isSame ? "var(--text-secondary)" : isSmaller ? "var(--success)" : "var(--error)",
                      }}
                    >
                      {isSame ? "≈ No change" : (
                        <>
                          {isSmaller ? "↓" : "↑"}{" "}
                          {formatSize(r.originalSize)} → {formatSize(r.compressedSize)} ({isSmaller ? "-" : "+"}{Math.abs(pct)}%)
                        </>
                      )}
                    </span>
                  </div>
                  <DownloadButton data={r.blob} filename={r.name} label="Download" />
                </div>
              )
            })}

            {failedResults.map((r) => (
              <div
                key={r.name}
                className="p-4 rounded-lg border"
                style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--error)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-sm" style={{ color: "var(--error)" }}>Error: {r.error}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
