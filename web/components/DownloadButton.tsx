"use client"

interface DownloadButtonProps {
  data: Blob
  filename: string
  label?: string
}

export default function DownloadButton({ data, filename, label = "Download" }: DownloadButtonProps) {
  const handleDownload = () => {
    const url = URL.createObjectURL(data)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleDownload}
      className="px-6 py-3 rounded-lg font-medium transition-colors"
      style={{
        backgroundColor: "var(--accent)",
        color: "white",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
    >
      ⬇ {label}
    </button>
  )
}
