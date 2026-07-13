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
    id: "bookmanager",
    name: "Book Manager",
    description: "Edit metadata, rename books, lookup info from APIs",
    icon: "📝",
    href: "/tools/bookmanager",
    accepts: [".pdf", ".epub"],
  },
  {
    id: "kindle",
    name: "Kindle Browser",
    description: "Browse and manage files on your Kindle via WebDAV",
    icon: "📱",
    href: "/tools/kindle",
    accepts: [],
  },
]