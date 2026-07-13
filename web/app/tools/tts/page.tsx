"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import FileUploader from "@/components/FileUploader"

interface VoiceInfo {
  name: string
  lang: string
  localService: boolean
  default: boolean
}

export default function TTSPage() {
  const [file, setFile] = useState<File | null>(null)
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [selectedVoice, setSelectedVoice] = useState("")
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [processing, setProcessing] = useState(false)
  const [previewText] = useState(
    "Hello! This is a preview of the text to speech voice. You can adjust the speed and pitch to your liking."
  )
  const [isPlaying, setIsPlaying] = useState(false)
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
  }, [selectedVoice])

  const previewVoice = useCallback(() => {
    if (isPlaying) {
      speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(previewText)
    const voice = voices.find((v) => v.name === selectedVoice)
    if (voice) {
      const synthVoice = speechSynthesis.getVoices().find((v) => v.name === voice.name)
      if (synthVoice) utterance.voice = synthVoice
    }
    utterance.rate = speed
    utterance.pitch = pitch
    utterance.onend = () => setIsPlaying(false)
    utteranceRef.current = utterance
    speechSynthesis.speak(utterance)
    setIsPlaying(true)
  }, [selectedVoice, speed, pitch, previewText, voices, isPlaying])

  const handleFileSelected = useCallback((files: File[]) => {
    setFile(files[0])
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">🔊 EBook to Voice</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Convert your ebooks to audio using offline text-to-speech
      </p>

      <FileUploader accept={[".pdf", ".epub"]} onFilesSelected={handleFileSelected} />

      {file && (
        <div
          className="mt-4 p-4 rounded-lg border flex items-center gap-3"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <span className="text-lg">{file.name.endsWith(".pdf") ? "📄" : "📚"}</span>
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {formatSize(file.size)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Voice</label>
          <select
            className="w-full px-4 py-2 rounded-lg border text-sm"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
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
          <label className="block text-sm font-medium mb-2">
            Speed: {speed.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Pitch: {pitch.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Voice Preview</label>
          <div
            className="p-4 rounded-lg border"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              &ldquo;{previewText}&rdquo;
            </p>
            <button
              onClick={previewVoice}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: isPlaying ? "var(--error)" : "var(--accent)",
                color: "white",
              }}
            >
              {isPlaying ? "⏹ Stop" : "▶ Preview Voice"}
            </button>
          </div>
        </div>
      </div>

      {file && (
        <button
          disabled={processing}
          className="mt-8 w-full py-3 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: processing ? "var(--bg-card)" : "var(--accent)",
            color: processing ? "var(--text-secondary)" : "white",
          }}
        >
          {processing ? "Converting..." : "Convert to Audio"}
        </button>
      )}
    </div>
  )
}
