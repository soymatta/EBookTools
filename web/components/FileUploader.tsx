"use client"

import { useCallback, useState, useRef } from "react"
import { MAX_FILE_SIZE } from "@/lib/utils"

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
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

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

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      setError("")
      const files = Array.from(fileList).filter((file) => {
        const ext = "." + file.name.split(".").pop()?.toLowerCase()
        return accept.includes(ext)
      })

      const oversized = files.find((f) => f.size > MAX_FILE_SIZE)
      if (oversized) {
        setError(`File "${oversized.name}" exceeds 100MB limit`)
        return
      }

      if (files.length > 0) {
        onFilesSelected(multiple ? files : [files[0]])
      }
    },
    [accept, multiple, onFilesSelected]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (disabled) return
      processFiles(e.dataTransfer.files)
    },
    [disabled, processFiles]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files)
      if (inputRef.current) inputRef.current.value = ""
    },
    [processFiles]
  )

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className="w-full p-8 rounded-xl border-2 border-dashed text-center transition-all duration-200 cursor-pointer"
      style={{
        borderColor: isDragging ? "var(--accent)" : "var(--border)",
        backgroundColor: isDragging ? "rgba(59,130,246,0.05)" : "var(--bg-secondary)",
        opacity: disabled ? 0.5 : 1,
      }}
      onClick={() => {
        if (!disabled && inputRef.current) {
          inputRef.current.click()
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(",")}
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
        tabIndex={-1}
      />

      <div className="text-4xl mb-3">
        {isDragging ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </div>
      <p className="text-sm mb-1" style={{ color: "var(--text-primary)" }}>
        {isDragging ? "Drop files here" : "Drop files here or click to browse"}
      </p>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Accepted: {accept.join(", ")}
        {multiple ? " (multiple files allowed)" : ""}
      </p>
      {error && (
        <p className="text-xs mt-2" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}
    </div>
  )
}
