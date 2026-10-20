/**
 * Embedded-metadata book renaming (fully offline — no API lookups).
 *
 * Renames badly named files from the title/author already stored inside
 * them (EPUB OPF, PDF docinfo). Files without usable embedded metadata keep
 * their original name (reported, not renamed). Covers are extracted from
 * inside the EPUB itself; never fetched from the network (see Offline rule
 * in AGENTS.md).
 */
import JSZip from "jszip"
import { extractEPUBMetadata, findOPFPath } from "./epub-parser"
import { sanitizeFilename } from "./utils"

export interface BookMetadata {
  title: string
  author: string
  year: string
  category: string
  isbn: string
  coverUrl: string
  description: string
  publisher: string
  pageCount: string
}

export interface RenameResult {
  originalName: string
  newName: string
  metadata: BookMetadata | null
  confidence: number
}

export const RENAME_FORMATS = [
  { id: "title-author", label: "{title} - {author}", template: "{title} - {author}" },
  { id: "title-author-year", label: "{title} - {author} ({year})", template: "{title} - {author} ({year})" },
  { id: "title-author-category", label: "{title} - {author} - {category}", template: "{title} - {author} - {category}" },
  { id: "author-title", label: "{author} - {title}", template: "{author} - {title}" },
]

export function applyRenameFormat(template: string, metadata: BookMetadata): string {
  let result = template
  result = result.replace(/\{title\}/g, metadata.title || "Unknown Title")
  result = result.replace(/\{author\}/g, metadata.author || "Unknown Author")
  result = result.replace(/\{year\}/g, metadata.year || "n.d.")
  result = result.replace(/\{category\}/g, metadata.category || "General")
  result = result.replace(/\{isbn\}/g, metadata.isbn || "")
  return sanitizeFilename(result)
}

// ============================================================
// FILE METADATA EXTRACTION (embedded only)
// ============================================================

export async function extractMetadataFromFile(file: File): Promise<BookMetadata | null> {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "epub") return extractFromEPUB(file)
  if (ext === "pdf") return extractFromPDF(file)
  return null
}

/** Cover image extracted from inside the EPUB (object URL, offline). */
async function extractEPUBCover(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)
    const opfPath = await findOPFPath(zip)
    if (!opfPath) return ""
    const opfText = await zip.file(opfPath)?.async("text")
    if (!opfText) return ""
    const doc = new DOMParser().parseFromString(opfText, "application/xml")
    const opfDir = opfPath.split("/").slice(0, -1).join("/")

    let coverHref: string | null = null
    doc.querySelectorAll("manifest > item").forEach((item) => {
      const props = (item.getAttribute("properties") || "").toLowerCase()
      const id = (item.getAttribute("id") || "").toLowerCase()
      if (props.includes("cover-image") || id === "cover" || id === "cover-image") {
        coverHref = item.getAttribute("href")
      }
    })
    if (!coverHref) return ""
    const coverPath = opfDir ? `${opfDir}/${coverHref}` : coverHref
    const entry = zip.file(coverPath)
    if (!entry) return ""
    const blob = await entry.async("blob")
    return URL.createObjectURL(blob)
  } catch {
    return ""
  }
}

async function extractFromEPUB(file: File): Promise<BookMetadata | null> {
  try {
    const meta = await extractEPUBMetadata(file)
    if (!meta) return null
    const coverUrl = await extractEPUBCover(file)
    return {
      title: meta.title,
      author: meta.creator,
      year: meta.date?.substring(0, 4) || "",
      category: meta.subject || "",
      isbn: meta.identifier,
      coverUrl,
      description: meta.description,
      publisher: meta.publisher,
      pageCount: "",
    }
  } catch {
    return null
  }
}

async function extractFromPDF(file: File): Promise<BookMetadata | null> {
  try {
    const { getDocument } = await import("pdfjs-dist")
    const buffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: buffer }).promise
    const metadata = await pdf.getMetadata()
    const info = metadata.info as Record<string, string> | undefined
    if (!info) return null

    return {
      title: info.Title || "",
      author: info.Author || "",
      year: info.CreationDate?.substring(0, 4) || "",
      category: info.Subject || "",
      isbn: "",
      coverUrl: "",
      description: info.Subject || "",
      publisher: info.Producer || "",
      pageCount: String(pdf.numPages),
    }
  } catch {
    return null
  }
}

// ============================================================
// AUTO RENAME (embedded metadata only)
// ============================================================

export async function autoRenameBooks(
  files: File[],
  renameFormat: string
): Promise<RenameResult[]> {
  const results: RenameResult[] = []

  for (const file of files) {
    const metadata = await extractMetadataFromFile(file)

    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    let newName: string
    let confidence: number

    if (metadata?.title || metadata?.author) {
      newName = applyRenameFormat(renameFormat, metadata as BookMetadata) + ext
      confidence = metadata.title ? 0.9 : 0.6
    } else {
      newName = file.name
      confidence = 0.2
    }

    results.push({
      originalName: file.name,
      newName,
      metadata,
      confidence,
    })
  }

  return results
}
