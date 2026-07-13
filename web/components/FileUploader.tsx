"use client"

import { useCallback, useState } from "react"

interface FileUploaderProps {
  accept: string[]
  multiple?: boolean
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

export default function FileUploader({
  accept,
  multiple = false,
  onFilesSelected,
  disabled = false,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (disabled) return

      const files = Array.from(e.dataTransfer.files).filter((file) => {
        const ext = "." + file.name.split(".").pop()?.toLowerCase()
        return accept.includes(ext)
      })

      if (files.length > 0) {
        onFilesSelected(multiple ? files : [files[0]])
      }
    },
    [accept, multiple, onFilesSelected, disabled]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        onFilesSelected(multiple ? files : [files[0]])
      }
      e.target.value = ""
    },
    [multiple, onFilesSelected]
  )

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className="w-full p-8 rounded-xl border-2 border-dashed text-center transition-colors cursor-pointer"
      style={{
        borderColor: isDragging ? "var(--accent)" : "var(--border)",
        backgroundColor: isDragging ? "rgba(59,130,246,0.05)" : "var(--bg-secondary)",
        opacity: disabled ? 0.5 : 1,
      }}
      onClick={() => {
        if (!disabled) {
          const input = document.createElement("input")
          input.type = "file"
          input.accept = accept.join(",")
          input.multiple = multiple
          input.onchange = (e) => handleFileInput(e as any)
          input.click()
        }
      }}
    >
      <div className="text-4xl mb-3">📁</div>
      <p className="text-sm mb-1" style={{ color: "var(--text-primary)" }}>
        Drop files here or click to browse
      </p>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Accepted: {accept.join(", ")}
        {multiple ? " (multiple files allowed)" : ""}
      </p>
    </div>
  )
}
