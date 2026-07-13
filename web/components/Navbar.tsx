"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { tools } from "@/app/tools/registry"

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b flex items-center px-6"
      style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <Link href="/" className="text-xl font-bold mr-8">
        📚 EBookTools
      </Link>

      <div className="hidden md:flex items-center gap-1">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            className="px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              color: pathname === tool.href ? "var(--accent)" : "var(--text-secondary)",
              backgroundColor: pathname === tool.href ? "rgba(59,130,246,0.1)" : "transparent",
            }}
          >
            {tool.icon} {tool.name}
          </Link>
        ))}
      </div>

      <div className="md:hidden ml-auto">
        <select
          className="px-3 py-2 rounded-lg text-sm border"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
          value={pathname}
          onChange={(e) => (window.location.href = e.target.value)}
        >
          <option value="/">Home</option>
          {tools.map((tool) => (
            <option key={tool.id} value={tool.href}>
              {tool.icon} {tool.name}
            </option>
          ))}
        </select>
      </div>
    </nav>
  )
}
