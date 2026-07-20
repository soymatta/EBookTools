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
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: "rgba(59,130,246,0.1)" }}
          >
            {tool.icon}
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">{tool.name}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {tool.description}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span
            className="text-xs px-2 py-1 rounded-md font-medium"
            style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)" }}
          >
            {tool.accepts.join(" / ").toUpperCase()}
          </span>
        </div>
      </div>
    </Link>
  )
}
