"use client"

import JSZip from "jszip"
import { sanitizeFilename } from "@/lib/utils"

interface DownloadButtonProps {
  data: Blob | Blob[]
  filename: string | string[]
  label?: string
  compact?: boolean
}

export default function DownloadButton({ data, filename, label = "Download", compact = false }: DownloadButtonProps) {
  const isMultiple = Array.isArray(data) && data.length > 1

  const handleDownload = async () => {
    if (isMultiple && Array.isArray(data) && Array.isArray(filename)) {
      const zip = new JSZip()
      data.forEach((blob, i) => {
        const safeName = sanitizeFilename(filename[i]) || `file_${i}`
        zip.file(safeName, blob)
      })
      const content = await zip.generateAsync({ type: "uint8array" })
      const blob = new Blob([content.slice().buffer as ArrayBuffer], { type: "application/zip" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "files.zip"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      const blob = Array.isArray(data) ? data[0] : data
      const name = sanitizeFilename(Array.isArray(filename) ? filename[0] : filename) || "download"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleDownload}
        className="text-xs px-2 py-1 rounded transition-colors duration-200 inline-flex items-center gap-1"
        style={{
          backgroundColor: "var(--accent)",
          color: "white",
        }}
        title={isMultiple ? `Download all as ZIP (${data.length} files)` : `Download ${filename}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {isMultiple ? `ZIP (${Array.isArray(data) ? data.length : 1})` : label}
      </button>
    )
  }

  return (
    <button
      onClick={handleDownload}
      className="px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 inline-flex items-center gap-2"
      style={{
        backgroundColor: "var(--accent)",
        color: "white",
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--accent-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--accent)"}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {isMultiple ? `Download All (${Array.isArray(data) ? data.length : 1})` : label}
    </button>
  )
}
