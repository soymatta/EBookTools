import JSZip from "jszip"

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

function sanitizeFilename(str: string): string {
  return str
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function cleanFilenameForSearch(filename: string): string {
  let name = filename.replace(/\.[^.]+$/, "")
  name = name.replace(/[_]+/g, " ")
  name = name.replace(/\b(pdf|epub|fb2|djvu|mobi|azw3|cbz|cbr|azw)\b/gi, "")
  name = name.replace(/\b(1080p|720p|480p|hd|cam|web|dl|bluray|dvdrip|brrip|repack|extended|uncut)\b/gi, "")
  name = name.replace(/\b(v\d+|part\d+|vol\d+|\d+)\b/gi, "")
  name = name.replace(/\s+/g, " ")
  return name.trim()
}

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
// FILE METADATA EXTRACTION
// ============================================================

export async function extractMetadataFromFile(file: File): Promise<BookMetadata | null> {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "epub") return extractFromEPUB(file)
  if (ext === "pdf") return extractFromPDF(file)
  return null
}

async function extractFromEPUB(file: File): Promise<BookMetadata | null> {
  try {
    const buffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)

    const containerFile = zip.file("META-INF/container.xml")
    if (!containerFile) return null

    const containerText = await containerFile.async("text")
    const parser = new DOMParser()
    const containerDoc = parser.parseFromString(containerText, "application/xml")
    const rootfile = containerDoc.querySelector("rootfile")
    const opfPath = rootfile?.getAttribute("full-path")
    if (!opfPath) return null

    const opfFile = zip.file(opfPath)
    if (!opfFile) return null

    const opfText = await opfFile.async("text")
    const opfDoc = parser.parseFromString(opfText, "application/xml")

    const getMeta = (name: string): string => {
      const el = opfDoc.querySelector(`metadata > dc\\:${name}, metadata > ${name}`)
      return el?.textContent || ""
    }

    return {
      title: getMeta("title"),
      author: getMeta("creator"),
      year: getMeta("date")?.substring(0, 4) || "",
      category: getMeta("subject"),
      isbn: getMeta("identifier"),
      coverUrl: "",
      description: getMeta("description"),
      publisher: getMeta("publisher"),
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
// API SEARCH - Open Library + Google Books
// ============================================================

export async function searchOpenLibrary(query: string): Promise<BookMetadata | null> {
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,first_publish_year,isbn,subject,publisher,number_of_pages_median,cover_i&limit=1`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    if (!data.docs || data.docs.length === 0) return null

    const doc = data.docs[0]
    const title = doc.title || ""
    const author = doc.author_name?.[0] || ""
    if (!title) return null

    const coverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : ""

    return {
      title,
      author,
      year: doc.first_publish_year?.toString() || "",
      category: doc.subject?.[0] || "",
      isbn: doc.isbn?.[0] || "",
      coverUrl,
      description: "",
      publisher: doc.publisher?.[0] || "",
      pageCount: doc.number_of_pages_median?.toString() || "",
    }
  } catch {
    return null
  }
}

export async function searchGoogleBooks(query: string): Promise<BookMetadata | null> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    if (!data.items || data.items.length === 0) return null

    const info = data.items[0].volumeInfo
    const title = info.title || ""
    if (!title) return null

    const isbn = info.industryIdentifiers?.find(
      (id: { type: string }) => id.type === "ISBN_13"
    )?.identifier || info.industryIdentifiers?.find(
      (id: { type: string }) => id.type === "ISBN_10"
    )?.identifier || ""

    return {
      title,
      author: info.authors?.[0] || "",
      year: info.publishedDate?.substring(0, 4) || "",
      category: info.categories?.[0] || "",
      isbn,
      coverUrl: info.imageLinks?.thumbnail || "",
      description: info.description || "",
      publisher: info.publisher || "",
      pageCount: info.pageCount?.toString() || "",
    }
  } catch {
    return null
  }
}

export async function searchByISBN(isbn: string): Promise<BookMetadata | null> {
  if (!isbn) return null

  const olResult = await searchOpenLibrary(`isbn:${isbn}`)
  if (olResult?.title) return olResult

  const gbResult = await searchGoogleBooks(`isbn:${isbn}`)
  if (gbResult?.title) return gbResult

  return null
}

async function searchMetadata(query: string): Promise<BookMetadata | null> {
  if (!query.trim()) return null

  const olResult = await searchOpenLibrary(query)
  if (olResult?.title) return olResult

  const gbResult = await searchGoogleBooks(query)
  if (gbResult?.title) return gbResult

  return null
}

// ============================================================
// AUTO RENAME
// ============================================================

export async function autoRenameBooks(
  files: File[],
  renameFormat: string
): Promise<RenameResult[]> {
  const results: RenameResult[] = []

  for (const file of files) {
    const fileMetadata = await extractMetadataFromFile(file)
    const filenameQuery = cleanFilenameForSearch(file.name)

    let metadata: BookMetadata | null = null

    // 1. If file has metadata, search API with it
    if (fileMetadata?.title) {
      const apiQuery = fileMetadata.author
        ? `${fileMetadata.title} ${fileMetadata.author}`
        : fileMetadata.title
      metadata = await searchMetadata(apiQuery)
    }

    // 2. If no result, search with cleaned filename
    if (!metadata && filenameQuery) {
      metadata = await searchMetadata(filenameQuery)
    }

    // 3. Try ISBN if found in filename
    if (!metadata) {
      const isbnMatch = filenameQuery.match(/\b(\d{10,13})\b/)
      if (isbnMatch) {
        metadata = await searchByISBN(isbnMatch[1])
      }
    }

    // 4. Fallback to file metadata
    if (!metadata && fileMetadata) {
      metadata = fileMetadata
    }

    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    let newName = ""

    if (metadata?.title || metadata?.author) {
      newName = applyRenameFormat(renameFormat, metadata) + ext
    } else {
      newName = file.name
    }

    const confidence = metadata?.title
      ? (fileMetadata?.title ? 0.95 : 0.7)
      : 0.2

    results.push({
      originalName: file.name,
      newName,
      metadata,
      confidence,
    })
  }

  return results
}
