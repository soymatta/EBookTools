import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "EPUB ↔ PDF Converter",
  description:
    "Convert EPUB to PDF and PDF to EPUB in your browser. Chapter order comes from the book spine; nothing is uploaded.",
}

export default function ConvertLayout({ children }: { children: React.ReactNode }) {
  return children
}
