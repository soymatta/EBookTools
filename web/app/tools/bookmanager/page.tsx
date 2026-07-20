"use client"

import { useState, useCallback } from "react"
import FileUploader from "@/components/FileUploader"
import DownloadButton from "@/components/DownloadButton"
import {
  autoRenameBooks,
  extractMetadataFromFile,
  RENAME_FORMATS,
  type RenameResult,
  type BookMetadata,
} from "@/lib/autoname-utils"
import { setPDFMetadata } from "@/lib/pdf-utils"
import { setEPUBMetadata } from "@/lib/epub-utils"
import { formatSize } from "@/lib/utils"

type Tab = "metadata" | "rename"

export default function BookManagerPage() {
  const [tab, setTab] = useState<Tab>("rename")
  const [files, setFiles] = useState<File[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<BookMetadata | null>(null)
  const [metadataLoaded, setMetadataLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<Blob | null>(null)

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
    if (selected.length === 1) {
      setSelectedFile(selected[0])
      setMetadataLoaded(false)
      setMetadata(null)
      setSaveResult(null)
    }
  }, [])

  const loadMetadata = async (file: File) => {
    setSelectedFile(file)
    setMetadataLoaded(false)
    setMetadata(null)
    const meta = await extractMetadataFromFile(file)
    setMetadata(meta || {
      title: file.name.replace(/\.[^.]+$/, ""),
      author: "",
      year: "",
      category: "",
      isbn: "",
      coverUrl: "",
      description: "",
      publisher: "",
      pageCount: "",
    })
    setMetadataLoaded(true)
  }

  const handleSaveMetadata = async () => {
    if (!selectedFile || !metadata) return
    setSaving(true)
    setSaveResult(null)
    try {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase()
      if (ext === "pdf") {
        const blob = await setPDFMetadata(selectedFile, {
          title: metadata.title,
          author: metadata.author,
          subject: metadata.description,
        })
        setSaveResult(blob)
      } else if (ext === "epub") {
        const blob = await setEPUBMetadata(selectedFile, {
          title: metadata.title,
          author: metadata.author,
          description: metadata.description,
          publisher: metadata.publisher,
        })
        setSaveResult(blob)
      }
    } catch (err) {
      console.error("Save metadata error:", err)
    } finally {
      setSaving(false)
    }
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
    setEditedNames(prev => ({ ...prev, [index]: name }))
  }

  const getFinalName = (result: RenameResult, index: number): string => {
    return editedNames[index] || result.newName
  }

  const downloadRenamed = () => {
    results.forEach((result, i) => {
      const finalName = getFinalName(result, i)
      if (finalName === result.originalName) return
      const originalFile = files.find(f => f.name === result.originalName)
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

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">📝 Book Manager</h1>
      <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
        Edit metadata, rename books with API lookup
      </p>

      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
        {([
          { id: "rename" as Tab, label: "🏷️ Auto Rename" },
          { id: "metadata" as Tab, label: "📋 Metadata Editor" },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === t.id ? "var(--accent)" : "transparent",
              color: tab === t.id ? "white" : "var(--text-secondary)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rename" && (
        <div>
          <FileUploader
            accept={[".pdf", ".epub"]}
            multiple
            onFilesSelected={handleFilesSelected}
            disabled={processing}
          />

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-lg border text-sm"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2">
                    <span>{file.name.endsWith(".pdf") ? "📄" : "📚"}</span>
                    <span className="font-medium truncate max-w-xs">{file.name}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{formatSize(file.size)}</span>
                  </div>
                  <button onClick={() => {
                    const newFiles = files.filter((_, j) => j !== i)
                    setFiles(newFiles)
                    setResults([])
                  }} style={{ color: "var(--error)" }} className="text-xs px-1">✕</button>
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Rename Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {RENAME_FORMATS.map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => { setFormat(fmt.template); setUseCustom(false) }}
                      className="px-3 py-2 rounded-lg text-xs border text-left transition-colors"
                      style={{
                        backgroundColor: !useCustom && format === fmt.template ? "var(--accent)" : "var(--bg-card)",
                        borderColor: !useCustom && format === fmt.template ? "var(--accent)" : "var(--border)",
                        color: !useCustom && format === fmt.template ? "white" : "var(--text-primary)",
                      }}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Custom: {title} - {author} - {year}"
                  value={customFormat}
                  onChange={e => { setCustomFormat(e.target.value); setUseCustom(true) }}
                  onFocus={() => setUseCustom(true)}
                  className="w-full px-4 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: useCustom ? "var(--accent)" : "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Tags: {"{title}"} {"{author}"} {"{year}"} {"{category}"} {"{isbn}"}
                </p>
              </div>
            </div>
          )}

          {files.length > 0 && !processing && results.length === 0 && (
            <button
              onClick={handleRename}
              className="mt-4 w-full py-2 rounded-lg font-medium text-sm transition-colors"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              Lookup & Rename {files.length} file{files.length > 1 ? "s" : ""}
            </button>
          )}

          {processing && (
            <div className="mt-4">
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-card)" }}>
                <div className="h-full rounded-full animate-pulse" style={{ backgroundColor: "var(--accent)", width: "60%" }} />
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>Searching APIs...</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold mb-3">Preview Changes</h2>
              <div className="space-y-2">
                {results.map((result, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border"
                    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: result.confidence > 0.7 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                          color: result.confidence > 0.7 ? "var(--success)" : "var(--error)",
                        }}
                      >
                        {result.confidence > 0.7 ? "✓" : "?"}
                      </span>
                      <span className="line-through" style={{ color: "var(--text-secondary)" }}>
                        {result.originalName}
                      </span>
                      <span>→</span>
                      <input
                        type="text"
                        value={getFinalName(result, i)}
                        onChange={e => updateEditedName(i, e.target.value)}
                        className="flex-1 px-2 py-1 rounded border text-xs"
                        style={{
                          backgroundColor: "var(--bg-primary)",
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                    {result.metadata?.coverUrl && (
                      <img
                        src={result.metadata.coverUrl}
                        alt="Cover"
                        className="h-16 mt-1 rounded"
                        style={{ backgroundColor: "var(--bg-primary)" }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={downloadRenamed}
                className="mt-4 w-full py-2 rounded-lg font-medium text-sm transition-colors"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                ⬇ Download Renamed Files
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "metadata" && (
        <div>
          <FileUploader
            accept={[".pdf", ".epub"]}
            onFilesSelected={handleFilesSelected}
          />

          {selectedFile && !metadataLoaded && (
            <div className="mt-4">
              <button
                onClick={() => loadMetadata(selectedFile)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                Load Metadata from {selectedFile.name}
              </button>
            </div>
          )}

          {metadata && metadataLoaded && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "title", label: "Title" },
                  { key: "author", label: "Author" },
                  { key: "year", label: "Year" },
                  { key: "isbn", label: "ISBN" },
                  { key: "publisher", label: "Publisher" },
                  { key: "category", label: "Category" },
                  { key: "pageCount", label: "Pages" },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium mb-1">{field.label}</label>
                    <input
                      type="text"
                      value={metadata[field.key as keyof BookMetadata] || ""}
                      onChange={e => setMetadata(prev => prev ? { ...prev, [field.key]: e.target.value } : prev)}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <textarea
                  value={metadata.description}
                  onChange={e => setMetadata(prev => prev ? { ...prev, description: e.target.value } : prev)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {metadata.coverUrl && (
                <div>
                  <label className="block text-xs font-medium mb-1">Cover</label>
                  <img src={metadata.coverUrl} alt="Cover" className="h-28 rounded" style={{ backgroundColor: "var(--bg-primary)" }} />
                </div>
              )}

              <button
                onClick={handleSaveMetadata}
                disabled={saving}
                className="w-full py-2 rounded-lg font-medium text-sm transition-colors"
                style={{
                  backgroundColor: saving ? "var(--bg-card)" : "var(--accent)",
                  color: saving ? "var(--text-secondary)" : "white",
                }}
              >
                {saving ? "Saving..." : "Save Metadata"}
              </button>

              {saveResult && (
                <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
                  <p className="text-sm mb-2">✅ Metadata saved</p>
                  <DownloadButton data={saveResult} filename={selectedFile?.name || "output"} label="Download" compact />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
