import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Compress PDF & EPUB",
  description:
    "Reduce PDF and EPUB file sizes in your browser. EPUB junk removal and repacking, PDF object-stream rebuilding. No uploads, no account.",
}

export default function CompressLayout({ children }: { children: React.ReactNode }) {
  return children
}
