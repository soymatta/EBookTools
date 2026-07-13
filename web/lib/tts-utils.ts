export interface TTSVoice {
  name: string
  lang: string
  localService: boolean
  default: boolean
}

export function getAvailableVoices(): TTSVoice[] {
  if (typeof window === "undefined") return []
  return speechSynthesis.getVoices().map((v) => ({
    name: v.name,
    lang: v.lang,
    localService: v.localService,
    default: v.default,
  }))
}

export function speak(
  text: string,
  options: {
    voice?: string
    rate?: number
    pitch?: number
    volume?: number
  } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text)

    if (options.voice) {
      const voices = speechSynthesis.getVoices()
      const voice = voices.find((v) => v.name === options.voice)
      if (voice) utterance.voice = voice
    }

    if (options.rate) utterance.rate = options.rate
    if (options.pitch) utterance.pitch = options.pitch
    if (options.volume) utterance.volume = options.volume

    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(e)

    speechSynthesis.speak(utterance)
  })
}

export function stopSpeaking() {
  speechSynthesis.cancel()
}
