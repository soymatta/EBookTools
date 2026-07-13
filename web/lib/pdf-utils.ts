import { PDFDocument } from "pdf-lib"

export async function compressPDF(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)

  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
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
