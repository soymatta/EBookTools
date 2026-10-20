import JSZip from "jszip"
import type { CompressionLevel } from "./config"
import { COMPRESSION_LEVELS } from "./config"
import { findOPFPath } from "./epub-parser"

const JUNK_FILES = /(^|\/)(?:\.(?:DS_Store|AppleDouble|LSOverride)|Thumbs\.db|desktop\.ini|__MACOSX)/i

// Only JPEG can be re-encoded to JPEG without lying about the media type.
// PNG/GIF/SVG/WebP keep their bytes: the OPF declares the original mimetype
// and a JPEG payload under a .png entry renders as a broken image.
const IMAGE_EXT = /\.jpe?g$/i

async function optimizeImage(data: Uint8Array, filename: string): Promise<Uint8Array> {
  if (typeof document === "undefined") return data
  if (!IMAGE_EXT.test(filename)) return data

  try {
    const blob = new Blob([data.slice().buffer as ArrayBuffer])
    const bmp = await createImageBitmap(blob)

    const canvas = document.createElement("canvas")
    const maxDim = 1400
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
    if (scale >= 1) return data // already small: re-encoding would only lose quality
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)

    const ctx = canvas.getContext("2d")
    if (!ctx) return data

    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    )
    if (!encoded) return data
    return new Uint8Array(await encoded.arrayBuffer())
  } catch {
    return data
  }
}

export async function compressEPUB(file: File, level: CompressionLevel = "normal"): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  const config = COMPRESSION_LEVELS[level]
  const newZip = new JSZip()

  let removedCount = 0
  let optimizedCount = 0

  const files = Object.keys(zip.files)
  for (const filename of files) {
    const zipEntry = zip.files[filename]
    if (zipEntry.dir) continue

    const isDotSegment = filename.split("/").some((seg) => seg.startsWith(".") && seg.length > 1)

    if (JUNK_FILES.test(filename) || isDotSegment) {
      removedCount++
      continue
    }

    if (filename === "mimetype") {
      const content = await zipEntry.async("uint8array")
      newZip.file(filename, content, { compression: "STORE" })
      continue
    }

    if (filename.endsWith(".opf") || filename.endsWith(".ncx")) {
      const text = await zipEntry.async("string")
      const cleaned = text.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim()
      newZip.file(filename, cleaned, {
        compression: "DEFLATE",
        compressionOptions: { level: config.epubZipLevel },
      })
      continue
    }

    let content = await zipEntry.async("uint8array")

    if (level === "strong" && IMAGE_EXT.test(filename)) {
      const optimized = await optimizeImage(content, filename)
      if (optimized.length < content.length) {
        content = optimized
        optimizedCount++
      }
    }

    newZip.file(filename, content, {
      compression: "DEFLATE",
      compressionOptions: { level: config.epubZipLevel },
    })
  }

  const compressed = await newZip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: config.epubZipLevel },
  })

  if (removedCount > 0 || optimizedCount > 0) {
    console.log(`EPUB: removed ${removedCount} junk files, optimized ${optimizedCount} images`)
  }

  return new Blob([compressed.slice().buffer as ArrayBuffer], { type: "application/epub+zip" })
}

export async function setEPUBMetadata(
  file: File,
  metadata: {
    title?: string
    author?: string
    description?: string
    language?: string
    identifier?: string
    publisher?: string
    date?: string
    subject?: string
  }
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const opfPath = await findOPFPath(zip)
  if (!opfPath) throw new Error("Could not find OPF file in EPUB")

  const opfFile = zip.file(opfPath)
  if (!opfFile) throw new Error("OPF file not found in ZIP")

  const opfText = await opfFile.async("text")
  const parser = new DOMParser()
  const doc = parser.parseFromString(opfText, "application/xml")

  const metadataEl = doc.querySelector("metadata")
  if (!metadataEl) throw new Error("No metadata element found in OPF")

  const setMeta = (name: string, value: string) => {
    if (!value) return
    const existing = metadataEl.querySelector(`dc\\:${name}, ${name}`)
    if (existing) {
      existing.textContent = value
    } else {
      const el = doc.createElementNS("http://purl.org/dc/elements/1.1/", `dc:${name}`)
      el.textContent = value
      metadataEl.appendChild(el)
    }
  }

  if (metadata.title) setMeta("title", metadata.title)
  if (metadata.author) setMeta("creator", metadata.author)
  if (metadata.description) setMeta("description", metadata.description)
  if (metadata.language) setMeta("language", metadata.language)
  if (metadata.identifier) setMeta("identifier", metadata.identifier)
  if (metadata.publisher) setMeta("publisher", metadata.publisher)
  if (metadata.date) setMeta("date", metadata.date)
  if (metadata.subject) setMeta("subject", metadata.subject)

  const serializer = new XMLSerializer()
  let updatedOpf = serializer.serializeToString(doc)
  updatedOpf = '<?xml version="1.0" encoding="UTF-8"?>\n' + updatedOpf

  zip.file(opfPath, updatedOpf)

  const newZipBytes = await zip.generateAsync({ type: "uint8array" })
  return new Blob([newZipBytes.slice().buffer as ArrayBuffer], { type: "application/epub+zip" })
}
