import { tools } from "./tools/registry"
import ToolCard from "@/components/ToolCard"

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">📚 EBookTools</h1>
        <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
          A collection of tools for your EBooks and EReaders
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          All processing happens locally in your browser. No files are uploaded to any server.
        </p>
      </div>
    </div>
  )
}
