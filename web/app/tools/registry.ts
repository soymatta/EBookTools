export interface Tool {
  id: string
  name: string
  description: string
  icon: string
  href: string
  accepts: string[]
}

export const tools: Tool[] = [
  {
    id: "compress",
    name: "Compress Books",
    description: "Reduce PDF and EPUB file sizes without losing quality",
    icon: "📦",
    href: "/tools/compress",
    accepts: [".pdf", ".epub"],
  },
  {
    id: "tts",
    name: "EBook to Voice",
    description: "Convert ebooks to audio using offline text-to-speech",
    icon: "🔊",
    href: "/tools/tts",
    accepts: [".pdf", ".epub"],
  },
  {
    id: "convert",
    name: "EPUB ↔ PDF",
    description: "Convert between EPUB and PDF formats",
    icon: "🔄",
    href: "/tools/convert",
    accepts: [".pdf", ".epub"],
  },
  {
    id: "metadata",
    name: "Metadata Editor",
    description: "Edit title, author, cover and other book metadata",
    icon: "📝",
    href: "/tools/metadata",
    accepts: [".pdf", ".epub"],
  },
  {
    id: "autoname",
    name: "AutoName",
    description: "Rename badly named books using metadata from free APIs",
    icon: "🏷️",
    href: "/tools/autoname",
    accepts: [".pdf", ".epub"],
  },
]
