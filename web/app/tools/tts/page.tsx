"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import FileUploader from "@/components/FileUploader"
import ErrorBoundary from "@/components/ErrorBoundary"
import { formatSize } from "@/lib/utils"
import { getEPUBChapters } from "@/lib/epub-parser"

interface VoiceInfo {
  name: string
  lang: string
  localService: boolean
  default: boolean
}

interface ChapterInfo {
  id: string
  title: string
  text: string
  selected: boolean
}

async function extractPDFText(file: File): Promise<string> {
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

async function extractPDFChapters(file: File): Promise<{ id: string; title: string; text: string }[]> {
  const { getDocument } = await import("pdfjs-dist")
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const chapters: { id: string; title: string; text: string }[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ")
    if (text.trim()) {
      chapters.push({ id: `page-${i}`, title: `Page ${i}`, text: text.trim() })
    }
  }
  return chapters
}

function TTSPageContent() {
  const [file, setFile] = useState<File | null>(null)
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [selectedVoice, setSelectedVoice] = useState("")
  const [languageFilter, setLanguageFilter] = useState("all")
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(1)
  const [processing, setProcessing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [chapters, setChapters] = useState<ChapterInfo[]>([])
  const [isEpub, setIsEpub] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [recording, setRecording] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const downloadMenuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const availableLanguages = Array.from(new Set(voices.map(v => v.lang))).sort()
  const filteredVoices = languageFilter === "all"
    ? voices
    : voices.filter(v => v.lang === languageFilter)

  const getSelectedVoiceObj = useCallback(() => {
    const v = voices.find(v => v.name === selectedVoice)
    if (!v) return null
    return speechSynthesis.getVoices().find(sv => sv.name === v.name) || null
  }, [voices, selectedVoice])

  const previewVoice = useCallback(() => {
    if (isPlaying) {
      speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }
    const previewText = chapters.length > 0 ? chapters[0].title : "Hello! This is a preview of the text to speech voice."
    const utterance = new SpeechSynthesisUtterance(previewText)
    const synthVoice = getSelectedVoiceObj()
    if (synthVoice) utterance.voice = synthVoice
    utterance.rate = speed
    utterance.pitch = pitch
    utterance.volume = volume
    utterance.onend = () => setIsPlaying(false)
    utteranceRef.current = utterance
    speechSynthesis.speak(utterance)
    setIsPlaying(true)
  }, [selectedVoice, speed, pitch, volume, voices, isPlaying, chapters, getSelectedVoiceObj])

  const speakText = useCallback((text: string, onDone?: () => void) => {
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const synthVoice = getSelectedVoiceObj()
    if (synthVoice) utterance.voice = synthVoice
    utterance.rate = speed
    utterance.pitch = pitch
    utterance.volume = volume
    utterance.onend = () => { setIsPlaying(false); onDone?.() }
    utterance.onerror = () => { setIsPlaying(false); setError("Speech synthesis error") }
    utteranceRef.current = utterance
    speechSynthesis.speak(utterance)
    setIsPlaying(true)
  }, [speed, pitch, volume, getSelectedVoiceObj])

  const handleListen = async () => {
    if (!file) return
    if (isPlaying) { speechSynthesis.cancel(); setIsPlaying(false); return }

    setProcessing(true)
    setError("")
    setStatus("Extracting text...")

    try {
      if (isEpub && chapters.length > 0) {
        const selectedChapters = chapters.filter(c => c.selected)
        if (selectedChapters.length === 0) {
          setError("Select at least one chapter")
          setProcessing(false)
          return
        }
        const fullText = selectedChapters.map(c => c.text).join("\n\n")
        if (!fullText.trim()) { setError("No text found"); setProcessing(false); return }
        setStatus(`Speaking ${fullText.length.toLocaleString()} characters...`)
        speakText(fullText, () => setStatus("Done!"))
      } else {
        const text = await extractPDFText(file)
        if (!text.trim()) { setError("No text found"); setProcessing(false); return }
        setStatus(`Speaking ${text.length.toLocaleString()} characters...`)
        speakText(text, () => setStatus("Done!"))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract text")
    } finally {
      setProcessing(false)
    }
  }

  const recordSpeech = async (text: string): Promise<Blob | null> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: false })
      const audioTrack = stream.getAudioTracks()[0]
      if (!audioTrack) { stream.getTracks().forEach(t => t.stop()); return null }

      const audioStream = new MediaStream([audioTrack])
      const recorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" })
      const chunks: Blob[] = []

      return new Promise((resolve, reject) => {
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
        recorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop())
          const blob = new Blob(chunks, { type: "audio/webm" })
          resolve(blob)
        }
        recorder.onerror = () => { stream.getTracks().forEach(t => t.stop()); reject(new Error("Recording failed")) }

        recorder.start()
        setRecording(true)

        const utterance = new SpeechSynthesisUtterance(text)
        const synthVoice = getSelectedVoiceObj()
        if (synthVoice) utterance.voice = synthVoice
        utterance.rate = speed
        utterance.pitch = pitch
        utterance.volume = 1
        utterance.onend = () => setTimeout(() => { recorder.stop(); setRecording(false) }, 300)
        utterance.onerror = () => { recorder.stop(); setRecording(false); reject(new Error("Speech error")) }
        speechSynthesis.speak(utterance)
      })
    } catch {
      setRecording(false)
      return null
    }
  }

  const handleDownload = async (mode: "all" | "selected") => {
    if (!file) return
    setShowDownloadMenu(false)
    setError("")
    setStatus("Preparing download...")

    try {
      let texts: { title: string; text: string }[] = []

      if (isEpub) {
        const selectedChapters = mode === "selected"
          ? chapters.filter(c => c.selected)
          : chapters
        if (selectedChapters.length === 0) { setError("Select at least one chapter"); return }
        texts = selectedChapters.map(c => ({ title: c.title, text: c.text }))
      } else {
        const pdfChapters = await extractPDFChapters(file)
        texts = pdfChapters.map(c => ({ title: c.title, text: c.text }))
      }

      if (texts.length === 1) {
        const blob = await recordSpeech(texts[0].text)
        if (!blob) { setError("Recording cancelled or not supported. Make sure to share your tab audio when prompted."); return }
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${texts[0].title.replace(/[^a-zA-Z0-9]/g, "_")}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const zip = (await import("jszip")).default
        const zipFile = new zip()
        for (const chapter of texts) {
          setStatus(`Recording: ${chapter.title}...`)
          const blob = await recordSpeech(chapter.text)
          if (blob) {
            zipFile.file(`${chapter.title.replace(/[^a-zA-Z0-9]/g, "_")}.webm`, blob)
          }
        }
        if (Object.keys(zipFile.files).length === 0) { setError("No audio recorded"); return }
        setStatus("Creating ZIP...")
        const content = await zipFile.generateAsync({ type: "uint8array" })
        const blob = new Blob([content.slice().buffer as ArrayBuffer], { type: "application/zip" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${file.name.replace(/\.[^.]+$/, "")}_audio.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
      setStatus("Download ready!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed")
    }
  }

  const handleFileSelected = useCallback(async (files: File[]) => {
    const f = files[0]
    setFile(f)
    setError("")
    setStatus("")
    setShowDownloadMenu(false)

    const ext = f.name.split(".").pop()?.toLowerCase()
    const epub = ext === "epub"
    setIsEpub(epub)

    if (epub) {
      try {
        const rawChapters = await getEPUBChapters(f)
        setChapters(rawChapters.map(c => ({ id: c.id, title: c.title, text: c.text, selected: true })))
      } catch {
        setChapters([])
      }
    } else {
      setChapters([])
    }
  }, [])

  const toggleChapter = (id: string) => {
    setChapters(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c))
  }

  const toggleAllChapters = (selected: boolean) => {
    setChapters(prev => prev.map(c => ({ ...c, selected })))
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">{"\uD83D\uDD0A"} EBook to Voice</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Listen to your ebooks using text-to-speech. Supports chapter selection and audio download.
      </p>

      <FileUploader accept={[".pdf", ".epub"]} onFilesSelected={handleFileSelected} />

      {file && (
        <div className="mt-4 p-4 rounded-lg border flex items-center gap-3"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          <span className="text-lg">{file.name.endsWith(".pdf") ? "\uD83D\uDCC4" : "\uD83D\uDCDA"}</span>
          <div className="flex-1">
            <p className="font-medium">{file.name}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatSize(file.size)}</p>
          </div>
          <button onClick={() => { setFile(null); setError(""); setStatus(""); setChapters([]) }}
            className="text-sm px-2 py-1 rounded" style={{ color: "var(--error)" }}>{"\u2715"}</button>
        </div>
      )}

      {isEpub && chapters.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Chapters ({chapters.filter(c => c.selected).length}/{chapters.length} selected)</label>
            <div className="flex gap-2">
              <button onClick={() => toggleAllChapters(true)} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)" }}>Select All</button>
              <button onClick={() => toggleAllChapters(false)} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)" }}>None</button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border p-2" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
            {chapters.map(ch => (
              <label key={ch.id} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm hover:opacity-80"
                style={{ backgroundColor: ch.selected ? "rgba(59,130,246,0.1)" : "transparent" }}>
                <input type="checkbox" checked={ch.selected} onChange={() => toggleChapter(ch.id)}
                  className="rounded" style={{ accentColor: "var(--accent)" }} />
                <span className="truncate">{ch.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Voice</label>
          <div className="flex gap-2">
            <select
              className="flex-1 px-4 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
            >
              <option value="all">All Languages</option>
              {availableLanguages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
            <select
              className="flex-1 px-4 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
            >
              {filteredVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang}){v.localService ? " [offline]" : ""}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {voices.length} voices available. Install additional voices through your operating system&apos;s speech settings.
          </p>
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
            <p className="text-sm mb-3 italic" style={{ color: "var(--text-secondary)" }}>
              {chapters.length > 0 ? `Previewing: "${chapters[0].title}"` : `"Hello! This is a preview of the text to speech voice."`}
            </p>
            <button onClick={previewVoice}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: isPlaying ? "var(--error)" : "var(--accent)", color: "white" }}>
              {isPlaying ? "\u23F9 Stop" : "\u25B6 Preview"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--error)" }}>
          {error}
        </div>
      )}

      {status && !recording && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)" }}>
          {status}
        </div>
      )}

      {recording && (
        <div className="mt-4 p-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: "var(--bg-card)", color: "var(--error)" }}>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Recording audio... Do not close this tab.
        </div>
      )}

      {file && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleListen}
            disabled={processing}
            className="flex-1 py-3 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: isPlaying ? "var(--error)" : processing ? "var(--bg-card)" : "var(--accent)",
              color: isPlaying ? "white" : processing ? "var(--text-secondary)" : "white",
            }}
          >
            {isPlaying ? "\u23F9 Stop Speaking" : processing ? "Extracting..." : "\uD83D\uDD0A Listen"}
          </button>

          <div className="relative" ref={downloadMenuRef}>
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={processing || recording}
              className="px-4 py-3 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: "var(--accent)",
                color: "white",
                opacity: (processing || recording) ? 0.5 : 1,
              }}
            >
              {"\u2B07"}
            </button>

            {showDownloadMenu && (
              <div
                className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border p-2 shadow-2xl z-50"
                style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
              >
                <p className="text-xs font-medium px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                  Download Audio
                </p>
                <button
                  onClick={() => handleDownload("all")}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ color: "var(--text-primary)" }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-card)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {"\uD83D\uDCFD"} Download Complete Book
                </button>
                {isEpub && chapters.filter(c => c.selected).length > 0 && (
                  <button
                    onClick={() => handleDownload("selected")}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ color: "var(--text-primary)" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-card)"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    {"\uD83D\uDCC2"} Download Selected Chapters
                  </button>
                )}
                <p className="text-xs px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                  You will be asked to share your screen (audio only) to capture the speech.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TTSPage() {
  return (
    <ErrorBoundary>
      <TTSPageContent />
    </ErrorBoundary>
  )
}
