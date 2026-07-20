"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import FileUploader from "@/components/FileUploader"
import { formatSize } from "@/lib/utils"

interface VoiceInfo {
  name: string
  lang: string
  localService: boolean
  default: boolean
}

const PREVIEW_TEXT = "Hello! This is a preview of the text to speech voice. You can adjust the speed and pitch to your liking."

async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase()

  if (ext === "pdf") {
    const { getDocument } = await import("pdfjs-dist")
    const buffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: buffer }).promise
    const parts: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      parts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "))
    }
    return parts.join("\n\n")
  }

  if (ext === "epub") {
    const JSZip = (await import("jszip")).default
    const buffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)

    const container = zip.file("META-INF/container.xml")
    if (!container) return ""
    const containerText = await container.async("text")
    const parser = new DOMParser()
    const doc = parser.parseFromString(containerText, "application/xml")
    const opfPath = doc.querySelector("rootfile")?.getAttribute("full-path")
    if (!opfPath) return ""

    const opfFile = zip.file(opfPath)
    if (!opfFile) return ""
    const opfText = await opfFile.async("text")
    const opfDoc = parser.parseFromString(opfText, "application/xml")

    const opfDir = opfPath.split("/").slice(0, -1).join("/")
    const items = opfDoc.querySelectorAll("manifest > item[media-type='application/xhtml+xml'], manifest > item[media-type='text/html']")
    const parts: string[] = []

    for (const item of Array.from(items)) {
      const href = item.getAttribute("href")
      if (!href) continue
      const filePath = opfDir ? `${opfDir}/${href}` : href
      const file = zip.file(filePath)
      if (!file) continue
      const html = await file.async("text")
      const htmlDoc = parser.parseFromString(html, "text/html")
      const text = htmlDoc.body?.textContent || ""
      if (text.trim()) parts.push(text.trim())
    }

    return parts.join("\n\n")
  }

  return ""
}

export default function TTSPage() {
  const [file, setFile] = useState<File | null>(null)
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [selectedVoice, setSelectedVoice] = useState("")
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(1)
  const [processing, setProcessing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    const loadVoices = () => {
      const available = speechSynthesis.getVoices()
      const mapped: VoiceInfo[] = available.map((v) => ({
        name: v.name,
        lang: v.lang,
        localService: v.localService,
        default: v.default,
      }))
      setVoices(mapped)
      if (mapped.length > 0 && !selectedVoice) {
        const defaultVoice = mapped.find((v) => v.default) || mapped[0]
        setSelectedVoice(defaultVoice.name)
      }
    }

    loadVoices()
    speechSynthesis.onvoiceschanged = loadVoices
  }, [])

  const previewVoice = useCallback(() => {
    if (isPlaying) {
      speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(PREVIEW_TEXT)
    const voice = voices.find((v) => v.name === selectedVoice)
    if (voice) {
      const synthVoice = speechSynthesis.getVoices().find((v) => v.name === voice.name)
      if (synthVoice) utterance.voice = synthVoice
    }
    utterance.rate = speed
    utterance.pitch = pitch
    utterance.volume = volume
    utterance.onend = () => setIsPlaying(false)
    utteranceRef.current = utterance
    speechSynthesis.speak(utterance)
    setIsPlaying(true)
  }, [selectedVoice, speed, pitch, volume, voices, isPlaying])

  const handleConvert = async () => {
    if (!file) return
    setProcessing(true)
    setError("")
    setStatus("Extracting text...")

    try {
      const text = await extractTextFromFile(file)
      if (!text.trim()) {
        setError("No text content found in the file")
        setProcessing(false)
        return
      }

      setStatus(`Speaking ${text.length.toLocaleString()} characters...`)
      speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      const voice = voices.find((v) => v.name === selectedVoice)
      if (voice) {
        const synthVoice = speechSynthesis.getVoices().find((v) => v.name === voice.name)
        if (synthVoice) utterance.voice = synthVoice
      }
      utterance.rate = speed
      utterance.pitch = pitch
      utterance.volume = volume
      utterance.onend = () => {
        setIsPlaying(false)
        setStatus("Done!")
      }
      utterance.onerror = () => {
        setIsPlaying(false)
        setError("Speech synthesis error")
        setStatus("")
      }
      utteranceRef.current = utterance
      speechSynthesis.speak(utterance)
      setIsPlaying(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract text")
      setStatus("")
    } finally {
      setProcessing(false)
    }
  }

  const stopSpeaking = () => {
    speechSynthesis.cancel()
    setIsPlaying(false)
    setStatus("")
  }

  const handleFileSelected = useCallback((files: File[]) => {
    setFile(files[0])
    setError("")
    setStatus("")
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">🔊 EBook to Voice</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Listen to your ebooks using text-to-speech
      </p>

      <FileUploader accept={[".pdf", ".epub"]} onFilesSelected={handleFileSelected} />

      {file && (
        <div className="mt-4 p-4 rounded-lg border flex items-center gap-3"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          <span className="text-lg">{file.name.endsWith(".pdf") ? "📄" : "📚"}</span>
          <div className="flex-1">
            <p className="font-medium">{file.name}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatSize(file.size)}</p>
          </div>
          <button onClick={() => { setFile(null); setError(""); setStatus("") }}
            className="text-sm px-2 py-1 rounded" style={{ color: "var(--error)" }}>✕</button>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Voice</label>
          <select
            className="w-full px-4 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
          >
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang}){v.localService ? " [offline]" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Speed: {speed.toFixed(1)}x</label>
          <input type="range" min="0.5" max="2" step="0.1" value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Pitch: {pitch.toFixed(1)}</label>
          <input type="range" min="0.5" max="2" step="0.1" value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))} className="w-full" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Volume: {Math.round(volume * 100)}%</label>
          <input type="range" min="0" max="1" step="0.05" value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Voice Preview</label>
          <div className="p-4 rounded-lg border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>&ldquo;{PREVIEW_TEXT}&rdquo;</p>
            <button onClick={previewVoice}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: isPlaying ? "var(--error)" : "var(--accent)", color: "white" }}>
              {isPlaying ? "⏹ Stop" : "▶ Preview Voice"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--error)" }}>
          {error}
        </div>
      )}

      {status && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)" }}>
          {status}
        </div>
      )}

      {file && (
        <button
          onClick={isPlaying ? stopSpeaking : handleConvert}
          disabled={processing}
          className="mt-6 w-full py-3 rounded-lg font-medium"
          style={{
            backgroundColor: isPlaying ? "var(--error)" : processing ? "var(--bg-card)" : "var(--accent)",
            color: isPlaying ? "white" : processing ? "var(--text-secondary)" : "white",
          }}
        >
          {isPlaying ? "⏹ Stop Speaking" : processing ? "Extracting text..." : "🔊 Listen to Book"}
        </button>
      )}
    </div>
  )
}
