"use client"

import { useState, useCallback } from "react"
import FileUploader from "@/components/FileUploader"
import DownloadButton from "@/components/DownloadButton"
import {
  autoRenameBooks,
  RENAME_FORMATS,
  RenameResult,
} from "@/lib/autoname-utils"

export default function AutoNamePage() {
  const [files, setFiles] = useState<File[]>([])
  const [format, setFormat] = useState(RENAME_FORMATS[0].template)
  const [customFormat, setCustomFormat] = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<RenameResult[]>([])
  const [editedNames, setEditedNames] = useState<Record<number, string>>({})

  const handleFilesSelected = useCallback((selected: File[]) => {
    setFiles(selected)
    setResults([])
    setEditedNames({})
  }, [])

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRename = async () => {
    setProcessing(true)
    setResults([])
    setEditedNames({})

    const selectedFormat = useCustom ? customFormat : format
    const renameResults = await autoRenameBooks(files, selectedFormat)

    setResults(renameResults)
    setProcessing(false)
  }

  const updateEditedName = (index: number, name: string) => {
    setEditedNames((prev) => ({ ...prev, [index]: name }))
  }

  const getFinalName = (result: RenameResult, index: number): string => {
    return editedNames[index] || result.newName
  }

  const downloadRenamed = () => {
    results.forEach((result, i) => {
      const finalName = getFinalName(result, i)
      if (finalName === result.originalName) return

      const originalFile = files.find((f) => f.name === result.originalName)
      if (!originalFile) return

      const blob = new Blob([originalFile], { type: originalFile.type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = finalName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">🏷️ AutoName</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Rename badly named books using metadata from free APIs
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
        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Rename Format</label>
            <div className="grid grid-cols-2 gap-2">
              {RENAME_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => {
                    setFormat(fmt.template)
                    setUseCustom(false)
                  }}
                  className="px-4 py-2 rounded-lg text-sm border text-left transition-colors"
                  style={{
                    backgroundColor:
                      !useCustom && format === fmt.template ? "var(--accent)" : "var(--bg-card)",
                    borderColor:
                      !useCustom && format === fmt.template ? "var(--accent)" : "var(--border)",
                    color:
                      !useCustom && format === fmt.template ? "white" : "var(--text-primary)",
                  }}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Or use custom format</label>
            <input
              type="text"
              placeholder="{title} - {author} - {year}"
              value={customFormat}
              onChange={(e) => {
                setCustomFormat(e.target.value)
                setUseCustom(true)
              }}
              onFocus={() => setUseCustom(true)}
              className="w-full px-4 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: useCustom ? "var(--accent)" : "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Available: {"{title}"}, {"{author}"}, {"{year}"}, {"{category}"}, {"{isbn}"}
            </p>
          </div>
        </div>
      )}

      {files.length > 0 && !processing && results.length === 0 && (
        <button
          onClick={handleRename}
          className="mt-6 w-full py-3 rounded-lg font-medium transition-colors"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          Lookup Metadata & Rename {files.length} file{files.length > 1 ? "s" : ""}
        </button>
      )}

      {processing && (
        <div className="mt-6">
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--bg-card)" }}
          >
            <div
              className="h-full rounded-full animate-pulse"
              style={{ backgroundColor: "var(--accent)", width: "60%" }}
            />
          </div>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Looking up metadata...
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Preview Changes</h2>
          <div className="space-y-3">
            {results.map((result, i) => (
              <div
                key={i}
                className="p-4 rounded-lg border"
                style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor:
                        result.confidence > 0.7 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                      color:
                        result.confidence > 0.7 ? "var(--success)" : "var(--error)",
                    }}
                  >
                    {result.confidence > 0.7 ? "High match" : "Low match"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm mb-2">
                  <span style={{ color: "var(--text-secondary)" }}>{result.originalName}</span>
                  <span>→</span>
                  <input
                    type="text"
                    value={getFinalName(result, i)}
                    onChange={(e) => updateEditedName(i, e.target.value)}
                    className="flex-1 px-2 py-1 rounded border text-sm"
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                {result.metadata && (
                  <div className="text-xs grid grid-cols-2 gap-1 mt-2" style={{ color: "var(--text-secondary)" }}>
                    {result.metadata.title && <div>Title: {result.metadata.title}</div>}
                    {result.metadata.author && <div>Author: {result.metadata.author}</div>}
                    {result.metadata.year && <div>Year: {result.metadata.year}</div>}
                    {result.metadata.category && <div>Category: {result.metadata.category}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={downloadRenamed}
            className="mt-6 w-full py-3 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            ⬇ Download Renamed Files
          </button>
        </div>
      )}
    </div>
  )
}
