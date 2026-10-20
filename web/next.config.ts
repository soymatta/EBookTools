import type { NextConfig } from "next"

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    // connect-src permits the single allowed online exception: the one-time
    // neural voice download from Hugging Face. Downloads redirect to the HF
    // CDN (e.g. us.aws.cdn.hf.co), so *.hf.co must be allowed too. Everything
    // else stays self/blob: fully offline.
    // script-src needs blob: because onnxruntime loads its (self-hosted) WASM
    // factory via a same-origin blob: URL.
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: https://huggingface.co https://*.huggingface.co https://*.hf.co; media-src 'self' blob:; font-src 'self' data:; worker-src 'self' blob:;",
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
