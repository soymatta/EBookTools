import JSZip from "jszip"

export interface BookMetadata {
  title: string
  author: string
  year: string
  category: string
  isbn: string
}

export interface RenameResult {
  originalName: string
  newName: string
  metadata: BookMetadata | null
  confidence: number
}

const RENAME_FORMATS = [
  { id: "title-author", label: "{title} - {author}", template: "{title} - {author}" },
  { id: "title-author-year", label: "{title} - {author} ({year})", template: "{title} - {author} ({year})" },
  { id: "title-author-category", label: "{title} - {author} - {category}", template: "{title} - {author} - {category}" },
  { id: "author-title", label: "{author} - {title}", template: "{author} - {title}" },
]

export { RENAME_FORMATS }

function sanitizeFilename(str: string): string {
  return str
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
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

export async function extractMetadataFromFile(file: File): Promise<BookMetadata | null> {
  const ext = file.name.split(".").pop()?.toLowerCase()

  if (ext === "epub") {
    return extractFromEPUB(file)
  } else if (ext === "pdf") {
    return extractFromPDF(file)
  }

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
      category: "",
      isbn: getMeta("identifier"),
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
    }
  } catch {
    return null
  }
}

export async function searchOpenLibrary(query: string): Promise<BookMetadata | null> {
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,first_publish_year,isbn,subject&limit=1`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    if (!data.docs || data.docs.length === 0) return null

    const doc = data.docs[0]
    return {
      title: doc.title || "",
      author: doc.author_name?.[0] || "",
      year: doc.first_publish_year?.toString() || "",
      category: doc.subject?.[0] || "",
      isbn: doc.isbn?.[0] || "",
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
    return {
      title: info.title || "",
      author: info.authors?.[0] || "",
      year: info.publishedDate?.substring(0, 4) || "",
      category: info.categories?.[0] || "",
      isbn: info.industryIdentifiers?.find((id: { type: string }) => id.type === "ISBN_13")?.identifier || "",
    }
  } catch {
    return null
  }
}

export async function lookupMetadata(
  fileMetadata: BookMetadata | null
): Promise<BookMetadata | null> {
  if (!fileMetadata) return null

  const query = [fileMetadata.title, fileMetadata.author].filter(Boolean).join(" ")
  if (!query.trim()) return null

  const olResult = await searchOpenLibrary(query)
  if (olResult && olResult.title) return olResult

  const gbResult = await searchGoogleBooks(query)
  if (gbResult && gbResult.title) return gbResult

  return null
}

export async function autoRenameBooks(
  files: File[],
  renameFormat: string
): Promise<RenameResult[]> {
  const results: RenameResult[] = []

  for (const file of files) {
    const fileMetadata = await extractMetadataFromFile(file)
    const apiMetadata = await lookupMetadata(fileMetadata)
    const metadata = apiMetadata || fileMetadata

    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    let newName = ""

    if (metadata && (metadata.title || metadata.author)) {
      newName = applyRenameFormat(renameFormat, metadata) + ext
    } else {
      newName = file.name
    }

    results.push({
      originalName: file.name,
      newName,
      metadata,
      confidence: metadata?.title ? 0.9 : 0.3,
    })
  }

  return results
}
