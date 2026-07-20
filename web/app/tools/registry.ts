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
    icon: "\uD83D\uDCE6",
    href: "/tools/compress",
    accepts: [".pdf", ".epub"],
  },
  {
    id: "tts",
    name: "EBook to Voice",
    description: "Listen to your ebooks using text-to-speech with adjustable voice settings",
    icon: "\uD83D\uDD0A",
    href: "/tools/tts",
    accepts: [".pdf", ".epub"],
  },
  {
    id: "convert",
    name: "Convert Ebooks",
    description: "Convert between EPUB and PDF formats with text extraction",
    icon: "\uD83D\uDD04",
    href: "/tools/convert",
    accepts: [".pdf", ".epub"],
  },
  {
    id: "bookmanager",
    name: "Book Manager",
    description: "Edit metadata, rename books using API lookup from Open Library and Google Books",
    icon: "\uD83D\uDCDD",
    href: "/tools/bookmanager",
    accepts: [".pdf", ".epub"],
  },
]
