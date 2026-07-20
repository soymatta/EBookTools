import { tools } from "./tools/registry"
import ToolCard from "@/components/ToolCard"

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "EBookToolbox",
    url: "https://ebooktoolbox.vercel.app",
    description:
      "Free online tools to compress, convert, and manage your ebooks. All processing happens locally in your browser.",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "PDF Compression",
      "EPUB Compression",
      "EPUB to PDF Conversion",
      "PDF to EPUB Conversion",
      "Text-to-Speech",
      "Metadata Editing",
      "Automatic Book Renaming",
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-16 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
          style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "var(--accent)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          100% Client-Side Processing
        </div>

        <h1 className="text-5xl font-bold mb-4 tracking-tight">
          EBook<span style={{ color: "var(--accent)" }}>Toolbox</span>
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
          Free tools to compress, convert, and manage your ebooks.
          Everything runs in your browser — your files never leave your device.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {tools.map((tool, i) => (
          <div key={tool.id} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
            <ToolCard tool={tool} />
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Supports PDF and EPUB formats. No account required. Open source under MIT License.
        </p>
      </div>
    </div>
    </>
  )
}
