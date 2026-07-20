import type { Metadata } from "next"
import "./globals.css"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"

export const metadata: Metadata = {
  title: {
    default: "EBookToolbox — Free Ebook Tools for PDF & EPUB",
    template: "%s | EBookToolbox",
  },
  description:
    "Free online tools to compress, convert, and manage your ebooks. PDF and EPUB compression, format conversion, text-to-speech, metadata editing, and automatic book renaming. All processing happens locally in your browser.",
  keywords: [
    "ebook tools",
    "pdf compressor",
    "epub to pdf",
    "pdf to epub",
    "book metadata",
    "text to speech",
    "free online tools",
    "ebook converter",
    "pdf compression",
    "epub compression",
  ],
  authors: [{ name: "Yassed Matta" }],
  creator: "Yassed Matta",
  metadataBase: new URL("https://ebooktoolbox.vercel.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ebooktoolbox.vercel.app",
    siteName: "EBookToolbox",
    title: "EBookToolbox — Free Ebook Tools for PDF & EPUB",
    description:
      "Free online tools to compress, convert, and manage your ebooks. All processing happens locally in your browser.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EBookToolbox — Free Ebook Tools for PDF & EPUB",
    description:
      "Free online tools to compress, convert, and manage your ebooks. All processing happens locally in your browser.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Navbar />
        <main className="min-h-screen pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
