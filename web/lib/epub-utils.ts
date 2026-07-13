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
