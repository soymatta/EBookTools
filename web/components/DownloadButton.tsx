"use client"

import JSZip from "jszip"

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
        zip.file(filename[i], blob)
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
      const name = Array.isArray(filename) ? filename[0] : filename
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
        className="text-xs px-2 py-1 rounded transition-colors inline-flex items-center gap-1"
        style={{
          backgroundColor: "var(--accent)",
          color: "white",
        }}
        title={isMultiple ? `Download all as ZIP (${data.length} files)` : `Download ${filename}`}
      >
        ⬇ {isMultiple ? `ZIP (${Array.isArray(data) ? data.length : 1})` : label}
      </button>
    )
  }

  return (
    <button
      onClick={handleDownload}
      className="px-4 py-2 rounded-lg font-medium text-sm transition-colors inline-flex items-center gap-2"
      style={{
        backgroundColor: "var(--accent)",
        color: "white",
      }}
    >
      ⬇ {isMultiple ? `Download All (${Array.isArray(data) ? data.length : 1})` : label}
    </button>
  )
}
