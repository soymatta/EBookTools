"use client"

import Link from "next/link"
import { Tool } from "@/app/tools/registry"

export default function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link href={tool.href}>
      <div
        className="group p-6 rounded-xl border transition-all duration-200 cursor-pointer h-full"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--bg-card-hover)"
          e.currentTarget.style.borderColor = "var(--accent)"
          e.currentTarget.style.transform = "translateY(-2px)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--bg-card)"
          e.currentTarget.style.borderColor = "var(--border)"
          e.currentTarget.style.transform = "translateY(0)"
        }}
      >
        <div className="text-4xl mb-4">{tool.icon}</div>
        <h3 className="text-lg font-semibold mb-2">{tool.name}</h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {tool.description}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span
            className="text-xs px-2 py-1 rounded"
            style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)" }}
          >
            {tool.accepts.join(", ")}
          </span>
        </div>
      </div>
    </Link>
  )
}
