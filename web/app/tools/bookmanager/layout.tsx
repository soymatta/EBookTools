import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Book Manager — Metadata & Rename",
  description:
    "Edit EPUB and PDF metadata and rename badly named books using their embedded title and author. Fully offline.",
}

export default function BookManagerLayout({ children }: { children: React.ReactNode }) {
  return children
}
