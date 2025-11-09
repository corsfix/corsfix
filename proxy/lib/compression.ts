import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";

const DEFAULT_TEXT_CONTENT_TYPE = "text/plain; charset=utf-8";

type SupportedEncoding = "br" | "gzip" | "deflate";

interface CompressionResult {
  compressed: Buffer;
  contentEncoding: SupportedEncoding | null;
  contentType: string;
}

const selectCompressionEncoding = (
  acceptEncoding?: string | null
): SupportedEncoding | null => {
  if (!acceptEncoding) {
    return null;
  }

  const normalized = acceptEncoding.toLowerCase();
  if (normalized.includes("br")) return "br";
  if (normalized.includes("gzip")) return "gzip";
  if (normalized.includes("deflate")) return "deflate";
  return null;
};

const resolveContentType = (contentType?: string | null): string => {
  if (!contentType) {
    return DEFAULT_TEXT_CONTENT_TYPE;
  }

  const normalized = contentType.toLowerCase();
  if (normalized.includes("charset=")) {
    return contentType;
  }

  if (normalized.startsWith("application/json")) {
    return "application/json; charset=utf-8";
  }

  if (normalized.startsWith("text/")) {
    return `${contentType}; charset=utf-8`;
  }

  return DEFAULT_TEXT_CONTENT_TYPE;
};

export const compressTextResponse = (
  acceptEncoding: string | undefined,
  text: string,
  providedContentType?: string | null
): CompressionResult => {
  const contentType = resolveContentType(providedContentType);
  const encoding = selectCompressionEncoding(acceptEncoding);
  const buffer = Buffer.from(text, "utf-8");

  if (!encoding) {
    return { compressed: buffer, contentEncoding: null, contentType };
  }

  try {
    switch (encoding) {
      case "br":
        return {
          compressed: brotliCompressSync(buffer),
          contentEncoding: "br",
          contentType,
        };
      case "gzip":
        return {
          compressed: gzipSync(buffer),
          contentEncoding: "gzip",
          contentType,
        };
      case "deflate":
        return {
          compressed: deflateSync(buffer),
          contentEncoding: "deflate",
          contentType,
        };
      default:
        return { compressed: buffer, contentEncoding: null, contentType };
    }
  } catch (error) {
    console.error("Failed to compress text response.", error);
    return { compressed: buffer, contentEncoding: null, contentType };
  }
};
