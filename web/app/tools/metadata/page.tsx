"use client"

import { useState, useCallback } from "react"
import FileUploader from "@/components/FileUploader"
import DownloadButton from "@/components/DownloadButton"

interface BookMetadata {
  title: string
  author: string
  description: string
  language: string
  isbn: string
  publisher: string
  date: string
  coverPreview: string | null
}

const emptyMetadata: BookMetadata = {
  title: "",
  author: "",
  description: "",
  language: "en",
  isbn: "",
  publisher: "",
  date: "",
  coverPreview: null,
}

export default function MetadataPage() {
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<BookMetadata>(emptyMetadata)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<Blob | null>(null)

  const handleFileSelected = useCallback(async (files: File[]) => {
    const f = files[0]
    setFile(f)
    setResult(null)
    setLoaded(false)

    // TODO: parse actual metadata from file
    // Placeholder: set empty metadata
    setMetadata({ ...emptyMetadata, title: f.name.replace(/\.[^.]+$/, "") })
    setLoaded(true)
  }, [])

  const handleSave = async () => {
    if (!file) return
    setSaving(true)
    setResult(null)

    try {
      // TODO: implement actual metadata saving
      await new Promise((r) => setTimeout(r, 500))
      setResult(new Blob(["Metadata save not yet implemented"], { type: "text/plain" }))
    } catch (err) {
      console.error("Save error:", err)
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: keyof BookMetadata, value: string) => {
    setMetadata((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">📝 Metadata Editor</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Edit title, author, cover and other book metadata
      </p>

      <FileUploader accept={[".pdf", ".epub"]} onFilesSelected={handleFileSelected} />

      {loaded && (
        <div className="mt-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full px-4 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Author</label>
              <input
                type="text"
                value={metadata.author}
                onChange={(e) => updateField("author", e.target.value)}
                className="w-full px-4 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Language</label>
              <input
                type="text"
                value={metadata.language}
                onChange={(e) => updateField("language", e.target.value)}
                className="w-full px-4 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ISBN</label>
              <input
                type="text"
                value={metadata.isbn}
                onChange={(e) => updateField("isbn", e.target.value)}
                className="w-full px-4 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Publisher</label>
              <input
                type="text"
                value={metadata.publisher}
                onChange={(e) => updateField("publisher", e.target.value)}
                className="w-full px-4 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="text"
                value={metadata.date}
                onChange={(e) => updateField("date", e.target.value)}
                className="w-full px-4 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={metadata.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
              className="w-full px-4 py-2 rounded-lg border text-sm resize-none"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cover Image</label>
            <div
              className="p-4 rounded-lg border flex items-center gap-4"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              {metadata.coverPreview ? (
                <img
                  src={metadata.coverPreview}
                  alt="Cover"
                  className="w-20 h-28 object-cover rounded"
                />
              ) : (
                <div
                  className="w-20 h-28 rounded flex items-center justify-center text-2xl"
                  style={{ backgroundColor: "var(--bg-primary)" }}
                >
                  📖
                </div>
              )}
              <div>
                <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
                  Upload a new cover image
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const url = URL.createObjectURL(file)
                      setMetadata((prev) => ({ ...prev, coverPreview: url }))
                    }
                  }}
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: saving ? "var(--bg-card)" : "var(--accent)",
              color: saving ? "var(--text-secondary)" : "white",
            }}
          >
            {saving ? "Saving..." : "Save Metadata"}
          </button>

          {result && (
            <div
              className="p-4 rounded-lg border"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <p className="font-medium mb-3">✅ Metadata saved</p>
              <DownloadButton
                data={result}
                filename={file?.name || "output"}
                label="Download"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
