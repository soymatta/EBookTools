"use client"

export default function Footer() {
  return (
    <footer
      className="border-t py-8 px-6"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          <span className="text-sm font-medium">EBookToolbox</span>
        </div>

        <p
          className="text-xs text-center"
          style={{ color: "var(--text-secondary)" }}
        >
          All processing happens locally in your browser. No files are uploaded
          to any server.
        </p>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/soymatta/EBookTools"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs transition-colors duration-200"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
          >
            GitHub
          </a>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            MIT License
          </span>
        </div>
      </div>
    </footer>
  );
}
