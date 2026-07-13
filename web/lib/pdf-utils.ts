import { PDFDocument } from "pdf-lib"

export type CompressionLevel = "light" | "normal" | "strong"

export const COMPRESSION_LEVELS: Record<CompressionLevel, {
  label: string
  description: string
  pdf: { useObjectStreams: boolean; objectsPerTick: number }
  epubZipLevel: number
}> = {
  light: {
    label: "Light",
    description: "Fastest. Removes duplicate objects and metadata. ~5-10% smaller.",
    pdf: { useObjectStreams: true, objectsPerTick: 100 },
    epubZipLevel: 1,
  },
  normal: {
    label: "Normal",
    description: "Balanced. Rebuilds object streams. ~15-30% smaller. Recommended.",
    pdf: { useObjectStreams: true, objectsPerTick: 50 },
    epubZipLevel: 6,
  },
  strong: {
    label: "Strong",
    description: "Maximum compression. Slowest. ~20-40% smaller. Same quality.",
    pdf: { useObjectStreams: true, objectsPerTick: 10 },
    epubZipLevel: 9,
  },
}

export async function compressPDF(file: File, level: CompressionLevel = "normal"): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  const config = COMPRESSION_LEVELS[level]

  const compressedBytes = await pdfDoc.save({
    useObjectStreams: config.pdf.useObjectStreams,
    addDefaultPage: false,
    objectsPerTick: config.pdf.objectsPerTick,
  })

  return new Blob([compressedBytes.slice().buffer as ArrayBuffer], { type: "application/pdf" })
}

export async function getPDFMetadata(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)

  return {
    title: pdfDoc.getTitle() || "",
    author: pdfDoc.getAuthor() || "",
    subject: pdfDoc.getSubject() || "",
    keywords: pdfDoc.getKeywords() || "",
    creator: pdfDoc.getCreator() || "",
    producer: pdfDoc.getProducer() || "",
    creationDate: pdfDoc.getCreationDate()?.toISOString() || "",
    modificationDate: pdfDoc.getModificationDate()?.toISOString() || "",
  }
}

export async function setPDFMetadata(
  file: File,
  metadata: {
    title?: string
    author?: string
    subject?: string
    keywords?: string
  }
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)

  if (metadata.title) pdfDoc.setTitle(metadata.title)
  if (metadata.author) pdfDoc.setAuthor(metadata.author)
  if (metadata.subject) pdfDoc.setSubject(metadata.subject)
  if (metadata.keywords) pdfDoc.setKeywords(metadata.keywords.split(","))

  const bytes = await pdfDoc.save()
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" })
}
