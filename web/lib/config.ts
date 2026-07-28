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
