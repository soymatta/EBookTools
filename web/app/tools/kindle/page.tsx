"use client"

import { useState } from "react"

interface FileEntry {
  name: string
  path: string
  type: "file" | "directory"
  size: number
  lastModified: string
}

export default function KindleBrowserPage() {
  const [host, setHost] = useState("")
  const [port, setPort] = useState("8080")
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState("")
  const [currentPath, setCurrentPath] = useState("/")
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const baseUrl = () => `http://${host}:${port}`

  const listDirectory = async (path: string) => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(baseUrl(), {
        method: "PROPFIND",
        headers: {
          Depth: "1",
          "Content-Type": "application/xml",
        },
      })
      if (!res.ok) throw new Error(`WebDAV error: ${res.status}`)

      const text = await res.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, "application/xml")
      const responses = doc.querySelectorAll("response")

      const items: FileEntry[] = []
      const basePath = path.endsWith("/") ? path : path + "/"

      responses.forEach((resp, i) => {
        if (i === 0) return
        const href = resp.querySelector("href")?.textContent || ""
        const hrefPath = decodeURIComponent(href)
        const name = hrefPath.split("/").filter(Boolean).pop() || ""
        if (!name) return

        const isDir = resp.querySelector("collection") !== null
        const lastMod = resp.querySelector("getlastmodified")?.textContent || ""
        const size = parseInt(resp.querySelector("getcontentlength")?.textContent || "0")

        items.push({
          name,
          path: isDir ? hrefPath : hrefPath,
          type: isDir ? "directory" : "file",
          size,
          lastModified: lastMod,
        })
      })

      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1
        return a.name.localeCompare(b.name)
      })

      setEntries(items)
      setCurrentPath(path)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!host) return
    setConnecting(true)
    setError("")
    try {
      await listDirectory("/")
      setConnected(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    setConnected(false)
    setEntries([])
    setSelected(new Set())
    setCurrentPath("/")
  }

  const navigateTo = (entry: FileEntry) => {
    if (entry.type === "directory") {
      const path = entry.path.endsWith("/") ? entry.path : entry.path + "/"
      listDirectory(path)
      setSelected(new Set())
    }
  }

  const goUp = () => {
    const parts = currentPath.split("/").filter(Boolean)
    parts.pop()
    listDirectory("/" + parts.join("/") + "/")
    setSelected(new Set())
  }

  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const selectAll = () => {
    setSelected(new Set(entries.map(e => e.name)))
  }

  const deselectAll = () => {
    setSelected(new Set())
  }

  const deleteSelected = async () => {
    for (const name of selected) {
      const entry = entries.find(e => e.name === name)
      if (!entry) continue
      try {
        await fetch(entry.path, { method: "DELETE" })
      } catch {}
    }
    listDirectory(currentPath)
    setSelected(new Set())
  }

  const createFolder = async () => {
    const name = prompt("Folder name:")
    if (!name) return
    const path = currentPath + name + "/"
    try {
      await fetch(path, { method: "MKCOL" })
      listDirectory(currentPath)
    } catch (e) {
      setError(String(e))
    }
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      try {
        const path = currentPath + encodeURIComponent(file.name)
        await fetch(path, {
          method: "PUT",
          body: file,
        })
      } catch (e) {
        setError(String(e))
      }
    }
    listDirectory(currentPath)
  }

  const downloadFile = async (entry: FileEntry) => {
    try {
      const res = await fetch(entry.path)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = entry.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(String(e))
    }
  }

  const renameEntry = async (entry: FileEntry) => {
    const newName = prompt("New name:", entry.name)
    if (!newName || newName === entry.name) return
    const parentPath = currentPath
    try {
      await fetch(parentPath + entry.name, {
        method: "MOVE",
        headers: { Destination: parentPath + encodeURIComponent(newName) },
      })
      listDirectory(currentPath)
    } catch (e) {
      setError(String(e))
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">📱 Kindle Browser</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Browse and manage files on your e-reader via WebDAV
      </p>

      {!connected ? (
        <div className="p-6 rounded-xl border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="IP address (e.g. 192.168.1.50)"
              value={host}
              onChange={e => setHost(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <input
              type="text"
              placeholder="Port"
              value={port}
              onChange={e => setPort(e.target.value)}
              className="w-24 px-4 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={handleConnect}
              disabled={!host || connecting}
              className="px-6 py-2 rounded-lg font-medium text-sm"
              style={{
                backgroundColor: connecting ? "var(--bg-card)" : "var(--accent)",
                color: connecting ? "var(--text-secondary)" : "white",
              }}
            >
              {connecting ? "Connecting..." : "Connect"}
            </button>
          </div>

          <div className="mt-4 p-3 rounded-lg text-xs" style={{ backgroundColor: "var(--bg-primary)" }}>
            <p className="font-medium mb-1">How to enable WebDAV on your device:</p>
            <ul className="space-y-1" style={{ color: "var(--text-secondary)" }}>
              <li>• <strong>KOReader:</strong> Settings → More → WebDAV → Start server</li>
              <li>• <strong>Calibre:</strong> Connect/share → Start Content Server</li>
            </ul>
            <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
              ⚠️ Your device must be on the same Wi-Fi network as this browser.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={goUp}
                disabled={currentPath === "/"}
                className="px-3 py-1.5 rounded-lg border text-sm"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border)",
                  color: currentPath === "/" ? "var(--text-secondary)" : "var(--text-primary)",
                }}
              >
                ← Back
              </button>
              <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                {currentPath}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-lg border text-sm"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                Disconnect
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={createFolder}
              className="px-3 py-1.5 rounded-lg border text-xs"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              + Folder
            </button>
            <label
              className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              + Upload
              <input
                type="file"
                multiple
                className="hidden"
                onChange={e => uploadFiles(e.target.files)}
              />
            </label>
            {selected.size > 0 && (
              <>
                <button
                  onClick={deleteSelected}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--error)", color: "var(--error)" }}
                >
                  Delete ({selected.size})
                </button>
                <button
                  onClick={deselectAll}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Clear
                </button>
              </>
            )}
            {selected.size === 0 && entries.length > 0 && (
              <button
                onClick={selectAll}
                className="px-3 py-1.5 rounded-lg border text-xs"
                style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Select All
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--error)" }}>
              {error}
              <button onClick={() => setError("")} className="ml-2 underline text-xs">dismiss</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            </div>
          ) : (
            <div className="space-y-1">
              {entries.map(entry => (
                <div
                  key={entry.name}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors"
                  style={{
                    backgroundColor: selected.has(entry.name) ? "rgba(59,130,246,0.1)" : "var(--bg-card)",
                    borderColor: selected.has(entry.name) ? "var(--accent)" : "var(--border)",
                  }}
                  onClick={() => {
                    if (entry.type === "directory") navigateTo(entry)
                    else toggleSelect(entry.name)
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(entry.name)}
                    onChange={() => toggleSelect(entry.name)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4"
                    style={{ accentColor: "var(--accent)" }}
                  />

                  <span className="text-lg">
                    {entry.type === "directory" ? "📁" : entry.name.endsWith(".epub") ? "📚" : "📄"}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{entry.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {entry.type === "directory" ? "Folder" : formatSize(entry.size)}
                      {entry.lastModified && ` • ${new Date(entry.lastModified).toLocaleDateString()}`}
                    </div>
                  </div>

                  {entry.type === "file" && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); downloadFile(entry) }}
                        className="px-2 py-1 rounded text-xs"
                        style={{ color: "var(--accent)" }}
                      >
                        ⬇
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); renameEntry(entry) }}
                        className="px-2 py-1 rounded text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {entries.length === 0 && (
                <div className="text-center py-12" style={{ color: "var(--text-secondary)" }}>
                  Empty folder
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
