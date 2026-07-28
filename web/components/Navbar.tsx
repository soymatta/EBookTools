"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { tools } from "@/app/tools/registry"

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-16 border-b flex items-center px-6"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <Link href="/" className="text-xl font-bold mr-8 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          EBookToolbox
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className="px-3 py-2 rounded-lg text-sm transition-colors duration-200"
              style={{
                color: pathname === tool.href ? "var(--accent)" : "var(--text-secondary)",
                backgroundColor: pathname === tool.href ? "rgba(59,130,246,0.1)" : "transparent",
              }}
            >
              {tool.icon} {tool.name}
            </Link>
          ))}
        </div>

        <button
          className="md:hidden ml-auto p-2 rounded-lg transition-colors duration-200"
          style={{ color: "var(--text-primary)" }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-16 right-4 w-64 rounded-xl border p-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              href="/"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors duration-200"
              style={{
                color: pathname === "/" ? "var(--accent)" : "var(--text-primary)",
                backgroundColor: pathname === "/" ? "rgba(59,130,246,0.1)" : "transparent",
              }}
            >
              Home
            </Link>
            {tools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors duration-200"
                style={{
                  color: pathname === tool.href ? "var(--accent)" : "var(--text-primary)",
                  backgroundColor: pathname === tool.href ? "rgba(59,130,246,0.1)" : "transparent",
                }}
              >
                <span className="text-lg">{tool.icon}</span>
                {tool.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
