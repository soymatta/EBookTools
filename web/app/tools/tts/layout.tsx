import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "EBook to Voice — Text to Speech",
  description:
    "Listen to PDF and EPUB books with system voices or in-browser neural voices (English and Spanish). Chapter selection, offline after the first voice download.",
}

export default function TtsLayout({ children }: { children: React.ReactNode }) {
  return children
}
