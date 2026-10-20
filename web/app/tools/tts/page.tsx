"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import FileUploader from "@/components/FileUploader"
import ErrorBoundary from "@/components/ErrorBoundary"
import { formatSize } from "@/lib/utils"
import { getEPUBChapters } from "@/lib/epub-parser"
import { cleanTextForTTS, hasNarrativeText } from "@/lib/tts-text"
import {
  NEURAL_VOICES,
  ensureNeuralVoice,
  synthesizeNeuralSpeech,
  type NeuralProgress,
} from "@/lib/neural-tts"

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

type Engine = "browser" | "neural"

const ENGINE_LABELS: Record<Engine, string> = {
  browser: "🌐 Browser voices",
  neural: "🧠 Neural (in-browser)",
}

async function extractPDFChapters(file: File): Promise<{ id: string; title: string; text: string }[]> {
  const { getDocument } = await import("pdfjs-dist")
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const chapters: { id: string; title: string; text: string }[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = cleanTextForTTS(content.items.map((item) => ("str" in item ? item.str : "")).join(" "))
    if (text.length >= 20) {
      chapters.push({ id: `page-${i}`, title: `Page ${i}`, text })
    }
  }
  return chapters
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function TTSPageContent() {
  const [file, setFile] = useState<File | null>(null)
  const [engine, setEngine] = useState<Engine>("browser")
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
  // Neural (in-browser) state
  const [neuralVoice, setNeuralVoice] = useState("en")
  const [neuralProgress, setNeuralProgress] = useState<NeuralProgress>({ status: "idle", percent: 0, detail: "" })
  const [testText, setTestText] = useState("Hello! This is a quick test of the text-to-speech engine.")
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
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
    return () => {
      document.removeEventListener("mousedown", handleClick)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const stopPlayback = useCallback(() => {
    speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setIsPlaying(false)
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

  const selectedText = useCallback(async (): Promise<{ title: string; text: string }[]> => {
    if (!file) return []
    if (isEpub) {
      const selectedChapters = chapters.filter(c => c.selected)
      return selectedChapters.map(c => ({ title: c.title, text: c.text }))
    }
    const pdfChapters = await extractPDFChapters(file)
    return pdfChapters.map(c => ({ title: c.title, text: c.text }))
  }, [file, isEpub, chapters])

  const previewVoice = useCallback(() => {
    if (isPlaying) {
      stopPlayback()
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
  }, [selectedVoice, speed, pitch, volume, voices, isPlaying, chapters, getSelectedVoiceObj, stopPlayback])

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

  useEffect(() => {
    if (engine === "neural" && neuralProgress.status === "idle") {
      ensureNeuralVoice(neuralVoice, setNeuralProgress).catch(() => {})
    }
  }, [engine, neuralProgress.status, neuralVoice])

  const playBlob = useCallback(async (blob: Blob, doneMsg: string) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    const url = URL.createObjectURL(blob)
    audioUrlRef.current = url
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => {
      setIsPlaying(false)
      setStatus(doneMsg)
      URL.revokeObjectURL(url)
      if (audioUrlRef.current === url) audioUrlRef.current = null
    }
    audio.onerror = () => {
      setIsPlaying(false)
      setError("Audio playback failed")
      URL.revokeObjectURL(url)
      if (audioUrlRef.current === url) audioUrlRef.current = null
    }
    await audio.play()
    setIsPlaying(true)
  }, [])

  const handleNeuralListen = useCallback(async () => {
    if (neuralProgress.status !== "ready") {
      setStatus("Loading neural model…")
      try {
        await ensureNeuralVoice(neuralVoice, setNeuralProgress)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Model failed to load")
        return
      }
    }
    const texts = await selectedText()
    if (texts.length === 0) { setError("No text found"); return }
    const fullText = texts.map(c => c.text).join("\n\n")
    setStatus(`Synthesizing ${fullText.length.toLocaleString()} characters in-browser…`)
    try {
      const blob = await synthesizeNeuralSpeech({
        text: fullText,
        voice: neuralVoice,
        onProgress: setNeuralProgress,
        onPart: (done, total) => setStatus(`Synthesizing part ${done}/${total}…`),
      })
      setStatus("Playing neural audio...")
      await playBlob(blob, "Done!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neural synthesis failed")
    }
  }, [neuralProgress.status, neuralVoice, selectedText, playBlob])

  const handleTestSpeech = useCallback(async () => {
    const raw = testText.trim()
    if (!raw) return
    if (isPlaying) { stopPlayback(); return }
    setError("")
    const clean = cleanTextForTTS(raw).trim() || raw
    if (engine === "neural") {
      if (neuralProgress.status !== "ready") {
        setStatus("Loading neural model…")
        try {
          await ensureNeuralVoice(neuralVoice, setNeuralProgress)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Model failed to load")
          return
        }
      }
      setStatus(`Synthesizing ${clean.length.toLocaleString()} characters in-browser…`)
      try {
        const blob = await synthesizeNeuralSpeech({
          text: clean,
          voice: neuralVoice,
          onProgress: setNeuralProgress,
          onPart: (done, total) => setStatus(`Synthesizing part ${done}/${total}…`),
        })
        setStatus("Playing neural audio...")
        await playBlob(blob, "Done!")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Neural synthesis failed")
      }
    } else {
      setStatus(`Speaking ${clean.length.toLocaleString()} characters...`)
      speakText(clean, () => setStatus("Done!"))
    }
  }, [testText, isPlaying, engine, neuralProgress.status, neuralVoice, stopPlayback, playBlob, speakText])

  const handleListen = async () => {
    if (!file) return
    if (isPlaying) { stopPlayback(); return }

    setProcessing(true)
    setError("")
    setStatus("Extracting text...")

    try {
      if (engine === "neural") {
        await handleNeuralListen()
      } else if (isEpub) {
        if (chapters.length === 0) {
          setError("No readable chapters found in this EPUB. Open it in a reader to check its structure.")
          setProcessing(false)
          return
        }
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
        const pdfChapters = await extractPDFChapters(file)
        const text = pdfChapters.map(c => c.text).join("\n\n")
        if (!text.trim()) {
          setError("No text found in this PDF. It may be a scanned/image-only file.")
          setProcessing(false)
          return
        }
        setStatus(`Speaking ${text.length.toLocaleString()} characters...`)
        speakText(text, () => setStatus("Done!"))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract text")
    } finally {
      setProcessing(false)
    }
  }

  /**
   * getDisplayMedia requires a video track (video:false throws TypeError), so
   * we request both and immediately stop the video track. The audio stream is
   * acquired once per download and reused for every chapter: a per-chapter
   * call would run outside the original user gesture and fail.
   */
  const acquireRecordingStream = async (): Promise<MediaStream | null> => {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    display.getVideoTracks().forEach((track) => track.stop())
    const audioTracks = display.getAudioTracks()
    if (audioTracks.length === 0) {
      display.getTracks().forEach((track) => track.stop())
      return null
    }
    return new MediaStream(audioTracks)
  }

  const recordSpeech = (text: string, stream: MediaStream): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type))
      let recorder: MediaRecorder
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      } catch {
        resolve(null)
        return
      }

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }))
      recorder.onerror = () => resolve(null)

      recorder.start()
      setRecording(true)

      const utterance = new SpeechSynthesisUtterance(text)
      const synthVoice = getSelectedVoiceObj()
      if (synthVoice) utterance.voice = synthVoice
      utterance.rate = speed
      utterance.pitch = pitch
      utterance.volume = 1
      utterance.onend = () => setTimeout(() => { recorder.stop(); setRecording(false) }, 300)
      utterance.onerror = () => { recorder.stop(); setRecording(false); resolve(null) }
      speechSynthesis.speak(utterance)
    })
  }

  const audioExtension = (blob: Blob): string => (blob.type.includes("mp4") ? "m4a" : "webm")

  const handleNeuralDownload = async (mode: "all" | "selected") => {
    if (!file) return
    setShowDownloadMenu(false)
    setError("")

    try {
      if (neuralProgress.status !== "ready") {
        setStatus("Loading neural model…")
        await ensureNeuralVoice(neuralVoice, setNeuralProgress)
      }
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
      if (texts.length === 0) { setError("No text found"); return }

      const safeBase = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "audiobook"
      if (texts.length === 1) {
        setStatus(`Synthesizing: ${texts[0].title}...`)
        const blob = await synthesizeNeuralSpeech({
          text: texts[0].text, voice: neuralVoice,
          onProgress: setNeuralProgress,
          onPart: (done, total) => setStatus(`Synthesizing part ${done}/${total}…`),
        })
        downloadBlob(blob, `${safeBase}_neural.wav`)
      } else {
        const zip = (await import("jszip")).default
        const zipFile = new zip()
        for (let i = 0; i < texts.length; i++) {
          const chapter = texts[i]
          setStatus(`Synthesizing ${i + 1}/${texts.length}: ${chapter.title}...`)
          const blob = await synthesizeNeuralSpeech({
            text: chapter.text, voice: neuralVoice,
            onProgress: setNeuralProgress,
            onPart: (done, total) => setStatus(`Synthesizing ${i + 1}/${texts.length}: ${chapter.title} — part ${done}/${total}…`),
          })
          const safeName = chapter.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "chapter"
          zipFile.file(`${safeName}.wav`, blob)
        }
        setStatus("Creating ZIP...")
        const content = await zipFile.generateAsync({ type: "uint8array" })
        downloadBlob(
          new Blob([content.slice().buffer as ArrayBuffer], { type: "application/zip" }),
          `${safeBase}_neural_audiobook.zip`
        )
      }
      setStatus("Download ready!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed")
    }
  }

  const handleDownload = async (mode: "all" | "selected") => {
    if (engine === "neural") {
      await handleNeuralDownload(mode)
      return
    }
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

      if (texts.length === 0) { setError("No text found"); return }

      let stream: MediaStream | null = null
      try {
        stream = await acquireRecordingStream()
      } catch (err) {
        setError(err instanceof Error ? `Screen capture not available: ${err.message}` : "Screen capture not available")
        return
      }
      if (!stream) {
        setError("No audio track was shared. Pick a tab/window and turn on \"Share tab audio\".")
        return
      }

      try {
        if (texts.length === 1) {
          const blob = await recordSpeech(texts[0].text, stream)
          if (!blob) { setError("Recording failed. Your browser may not support MediaRecorder audio capture."); return }
          downloadBlob(blob, `${texts[0].title.replace(/[^a-zA-Z0-9]/g, "_")}.${audioExtension(blob)}`)
        } else {
          const zip = (await import("jszip")).default
          const zipFile = new zip()
          for (let i = 0; i < texts.length; i++) {
            const chapter = texts[i]
            setStatus(`Recording ${i + 1}/${texts.length}: ${chapter.title}...`)
            const blob = await recordSpeech(chapter.text, stream)
            if (blob) {
              zipFile.file(`${chapter.title.replace(/[^a-zA-Z0-9]/g, "_")}.${audioExtension(blob)}`, blob)
            }
          }
          if (Object.keys(zipFile.files).length === 0) { setError("No audio recorded"); return }
          setStatus("Creating ZIP...")
          const content = await zipFile.generateAsync({ type: "uint8array" })
          downloadBlob(
            new Blob([content.slice().buffer as ArrayBuffer], { type: "application/zip" }),
            `${file.name.replace(/\.[^.]+$/, "")}_audio.zip`
          )
        }
      } finally {
        stream.getTracks().forEach((track) => track.stop())
      }
      setStatus("Download ready!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed")
    }
  }

  const handleFileSelected = useCallback(async (files: File[]) => {
    const f = files[0]
    stopPlayback()
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
        const cleaned = rawChapters
          .map(c => ({ id: c.id, title: c.title, text: c.text, selected: true }))
          .filter(c => hasNarrativeText(c.text))
        setChapters(cleaned)
        if (cleaned.length < rawChapters.length) {
          setStatus(`Skipped ${rawChapters.length - cleaned.length} empty section(s).`)
        }
      } catch {
        setChapters([])
        setError("Could not read this EPUB: it may be DRM-protected or malformed.")
      }
    } else {
      setChapters([])
    }
  }, [stopPlayback])

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

      <div className="flex gap-2 mb-6">
        {(["browser", "neural"] as Engine[]).map((e) => (
          <button
            key={e}
            onClick={() => { stopPlayback(); setEngine(e); setError(""); setStatus("") }}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: engine === e ? "var(--accent)" : "var(--bg-card)",
              color: engine === e ? "white" : "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            {ENGINE_LABELS[e]}
          </button>
        ))}
      </div>

      {engine === "neural" && (
        <div className="mb-6 p-4 rounded-xl border space-y-3"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: neuralProgress.status === "ready"
                  ? "var(--success)"
                  : neuralProgress.status === "error" ? "var(--error)" : "var(--text-secondary)",
              }} />
            <p className="text-sm">
              {neuralProgress.status === "ready"
                ? "Neural model loaded — runs 100% in your browser. Cached: works offline from now on."
                : neuralProgress.status === "loading"
                  ? neuralProgress.detail || "Loading neural model…"
                  : neuralProgress.status === "error"
                    ? neuralProgress.detail || "Neural model failed to load. Retry, and check the browser console for details."
                    : "Loads the neural voice once (~100 MB per language, cached after)."}
            </p>
          </div>
          {neuralProgress.status === "loading" && neuralProgress.percent >= 0 && (
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)" }}>
              <div className="h-full rounded-full transition-all" style={{ backgroundColor: "var(--accent)", width: `${neuralProgress.percent}%` }} />
            </div>
          )}
          <div className="flex gap-2">
            <select
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              value={neuralVoice}
              onChange={(e) => setNeuralVoice(e.target.value)}
            >
              {NEURAL_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            {neuralProgress.status !== "ready" && neuralProgress.status !== "loading" && (
              <button
                onClick={() => ensureNeuralVoice(neuralVoice, setNeuralProgress).catch(() => {})}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                Load model
              </button>
            )}
          </div>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Neural English + Spanish voices, best quality on short chapters. Slower than realtime on weak CPUs — downloads are WAV files.
          </p>
        </div>
      )}

      <div className="mb-6 p-4 rounded-xl border"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
        <label className="block text-sm font-medium mb-2">Test the voice with your own text</label>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          rows={3}
          placeholder="Type anything and press Play…"
          className="w-full px-3 py-2 rounded-lg border text-sm mb-3 resize-y"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <button
          onClick={handleTestSpeech}
          disabled={!testText.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: !testText.trim()
              ? "var(--bg-card)"
              : isPlaying ? "var(--error)" : "var(--accent)",
            color: !testText.trim() ? "var(--text-secondary)" : "white",
          }}
        >
          {isPlaying ? "\u23F9 Stop" : "\u25B6 Play test"}
        </button>
        <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          No file needed — speaks whatever you type using the selected engine and voice.
        </p>
      </div>

      <FileUploader accept={[".pdf", ".epub"]} onFilesSelected={handleFileSelected} />

      {file && (
        <div className="mt-4 p-4 rounded-lg border flex items-center gap-3"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          <span className="text-lg">{file.name.endsWith(".pdf") ? "\uD83D\uDCC4" : "\uD83D\uDCDA"}</span>
          <div className="flex-1">
            <p className="font-medium">{file.name}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatSize(file.size)}</p>
          </div>
          <button onClick={() => { stopPlayback(); setFile(null); setError(""); setStatus(""); setChapters([]) }}
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
        {engine === "browser" ? (
          <>
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
          </>
        ) : (
          <div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {engine === "neural"
                ? "Neural synthesis right in your browser — no server, no install. Each voice downloads once and stays cached for offline use."
                : "Browser voices use your operating system's speech engine — free, offline, no downloads."}
            </p>
          </div>
        )}

        {engine === "browser" && (
          <div>
            <label className="block text-sm font-medium mb-2">Speed: {speed.toFixed(1)}x</label>
            <input type="range" min="0.5" max="2" step="0.1" value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full" />
          </div>
        )}
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
                {engine === "browser" && (
                  <p className="text-xs px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                    You will be asked to share your screen (audio only) to capture the speech.
                  </p>
                )}
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
