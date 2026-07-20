import JSZip from "jszip"
import type { CompressionLevel } from "./pdf-utils"
import { COMPRESSION_LEVELS } from "./pdf-utils"

const JUNK_FILES = /^\.(DS_Store|AppleDouble|LSOverride)|Thumbs\.db|desktop\.ini|__MACOSX/i

const BINARY_EXT = /\.(jpg|jpeg|png|gif|webp|svg|woff2?|ttf|otf|mp[34]|ogg|wav)$/i
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)$/i

async function optimizeImage(data: Uint8Array, filename: string): Promise<Uint8Array> {
  if (typeof ImageData === "undefined") return data
  if (!IMAGE_EXT.test(filename)) return data

  try {
    const blob = new Blob([data.slice().buffer as ArrayBuffer])
    const bmp = await createImageBitmap(blob)

    const canvas = document.createElement("canvas")
    const maxDim = 1200
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)

    const ctx = canvas.getContext("2d")
    if (!ctx) return data

    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75)
    const res = await fetch(dataUrl)
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
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

    if (JUNK_FILES.test(filename) || filename.startsWith(".")) {
      removedCount++
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

    if (level !== "light" && BINARY_EXT.test(filename)) {
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

export async function getEPUBMetadata(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const opfPath = await findOPFPath(zip)
  if (!opfPath) return null

  const opfContent = await zip.file(opfPath)?.async("text")
  if (!opfContent) return null

  const parser = new DOMParser()
  const doc = parser.parseFromString(opfContent, "application/xml")

  const getMeta = (name: string): string => {
    const el =
      doc.querySelector(`metadata > dc\\:${name}, metadata > ${name}`) ||
      doc.querySelector(`metadata > [name="${name}"]`)
    return el?.textContent || ""
  }

  return {
    title: getMeta("title"),
    creator: getMeta("creator"),
    language: getMeta("language"),
    identifier: getMeta("identifier"),
    description: getMeta("description"),
    publisher: getMeta("publisher"),
    date: getMeta("date"),
  }
}

async function findOPFPath(zip: JSZip): Promise<string | null> {
  const containerFile = zip.file("META-INF/container.xml")
  if (!containerFile) return null

  const containerText = await containerFile.async("text")
  const parser = new DOMParser()
  const doc = parser.parseFromString(containerText, "application/xml")

  const rootfile = doc.querySelector("rootfile")
  return rootfile?.getAttribute("full-path") || null
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

  const setMetaArray = (name: string, value: string) => {
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
  if (metadata.author) setMetaArray("creator", metadata.author)
  if (metadata.description) {
    const existing = metadataEl.querySelector("dc\\:description, description")
    if (existing) existing.textContent = metadata.description
    else {
      const el = doc.createElementNS("http://purl.org/dc/elements/1.1/", "dc:description")
      el.textContent = metadata.description
      metadataEl.appendChild(el)
    }
  }
  if (metadata.language) setMetaArray("language", metadata.language)
  if (metadata.identifier) setMeta("identifier", metadata.identifier)
  if (metadata.publisher) setMeta("publisher", metadata.publisher)

  const serializer = new XMLSerializer()
  let updatedOpf = serializer.serializeToString(doc)
  updatedOpf = '<?xml version="1.0" encoding="UTF-8"?>\n' + updatedOpf

  zip.file(opfPath, updatedOpf)

  const newZipBytes = await zip.generateAsync({ type: "uint8array" })
  return new Blob([newZipBytes.slice().buffer as ArrayBuffer], { type: "application/epub+zip" })
}
