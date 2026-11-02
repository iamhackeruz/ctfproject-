"use client";

import React from "react";

interface MarkdownViewProps {
  content: string;
}

/**
 * Xavfsiz Markdown rendereri (dangerouslySetInnerHTML'siz, React JSX asosida).
 * XSS inyeksiya xavfini 100% bartaraf etadi.
 */
export function MarkdownView({ content }: MarkdownViewProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBuffer: string[] = [];
  let blockQuoteBuffer: string[] = [];
  let alertType: "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | null = null;

  const flushCodeBlock = (key: number) => {
    if (codeBuffer.length > 0) {
      elements.push(
        <div
          key={`code-${key}`}
          style={{
            background: "#090d16",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            borderRadius: 8,
            padding: "14px 18px",
            margin: "12px 0",
            overflowX: "auto",
          }}
        >
          {codeBlockLang && (
            <div
              style={{
                fontSize: "0.75rem",
                color: "#94a3b8",
                textTransform: "uppercase",
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              {codeBlockLang}
            </div>
          )}
          <pre
            style={{
              margin: 0,
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              fontSize: "0.88rem",
              color: "#34d399",
              lineHeight: 1.5,
            }}
          >
            {codeBuffer.join("\n")}
          </pre>
        </div>
      );
      codeBuffer = [];
      codeBlockLang = "";
    }
  };

  const flushBlockQuote = (key: number) => {
    if (blockQuoteBuffer.length > 0) {
      const borderColor =
        alertType === "IMPORTANT"
          ? "#ef4444"
          : alertType === "TIP"
          ? "#10b981"
          : alertType === "WARNING"
          ? "#f59e0b"
          : "#38bdf8";

      const bgColor =
        alertType === "IMPORTANT"
          ? "rgba(239, 68, 68, 0.08)"
          : alertType === "TIP"
          ? "rgba(16, 185, 129, 0.08)"
          : alertType === "WARNING"
          ? "rgba(245, 158, 11, 0.08)"
          : "rgba(56, 189, 248, 0.08)";

      elements.push(
        <blockquote
          key={`quote-${key}`}
          style={{
            borderLeft: `4px solid ${borderColor}`,
            background: bgColor,
            padding: "12px 16px",
            margin: "12px 0",
            borderRadius: "0 8px 8px 0",
            color: "#e2e8f0",
            fontSize: "0.92rem",
            lineHeight: 1.6,
          }}
        >
          {alertType && (
            <strong style={{ color: borderColor, display: "block", marginBottom: 4 }}>
              [{alertType}]
            </strong>
          )}
          {blockQuoteBuffer.map((line, idx) => (
            <p key={idx} style={{ margin: "4px 0" }}>
              {renderInline(line)}
            </p>
          ))}
        </blockquote>
      );
      blockQuoteBuffer = [];
      alertType = null;
    }
  };

  lines.forEach((line, index) => {
    // Code block ochilishi/yopilishi
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock(index);
        inCodeBlock = false;
      } else {
        flushBlockQuote(index);
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const quoteText = line.replace(/^>\s?/, "");
      const alertMatch = quoteText.match(/\[!(NOTE|TIP|IMPORTANT|WARNING)\]/);
      if (alertMatch) {
        alertType = alertMatch[1] as "NOTE" | "TIP" | "IMPORTANT" | "WARNING";
      } else {
        blockQuoteBuffer.push(quoteText);
      }
      return;
    } else if (blockQuoteBuffer.length > 0) {
      flushBlockQuote(index);
    }

    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    // Sarlavhalar
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3
          key={`h3-${index}`}
          style={{ color: "#38bdf8", fontSize: "1.25rem", margin: "18px 0 10px 0" }}
        >
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={`h2-${index}`}
          style={{ color: "#f8fafc", fontSize: "1.45rem", margin: "22px 0 12px 0" }}
        >
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1
          key={`h1-${index}`}
          style={{ color: "#f8fafc", fontSize: "1.75rem", margin: "26px 0 16px 0" }}
        >
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      return;
    }

    // Ro'yxatlar (- yoki *)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li
          key={`li-${index}`}
          style={{ color: "#cbd5e1", marginLeft: 20, marginBottom: 6, lineHeight: 1.6 }}
        >
          {renderInline(trimmed.slice(2))}
        </li>
      );
      return;
    }

    // Raqamlangan ro'yxatlar (1. 2.)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div
          key={`num-${index}`}
          style={{ color: "#cbd5e1", marginLeft: 16, marginBottom: 6, lineHeight: 1.6 }}
        >
          <strong style={{ color: "#38bdf8" }}>{numMatch[1]}.</strong> {renderInline(numMatch[2])}
        </div>
      );
      return;
    }

    // Oddiy matn paragrafi
    elements.push(
      <p
        key={`p-${index}`}
        style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: "0.94rem", margin: "8px 0" }}
      >
        {renderInline(trimmed)}
      </p>
    );
  });

  if (inCodeBlock) flushCodeBlock(lines.length);
  if (blockQuoteBuffer.length > 0) flushBlockQuote(lines.length);

  return <div className="markdown-body">{elements}</div>;
}

const ALLOWED_IMAGE_HOSTS = [
  "cyberedu.uz",
  "raw.githubusercontent.com",
  "images.unsplash.com",
  "avatars.githubusercontent.com",
];

/**
 * Havolaning xavfsizligini tekshirish.
 * javascript:, data:, vbscript: protokollari qat'iy bloklanadi.
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  // Taqiqlangan xavfli sxemalar
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("file:")
  ) {
    return false;
  }
  // Faqat http, https yoki nisbiy yo'l
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  );
}

/**
 * Rasm manzilining ruxsat etilgan hostda ekanligini tekshirish.
 */
export function isSafeImageUrl(src: string): boolean {
  if (!isSafeUrl(src)) return false;
  const trimmed = src.trim();
  if (trimmed.startsWith("/")) return true; // Lokal manzil
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_IMAGE_HOSTS.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith("." + h)
    );
  } catch {
    return false;
  }
}

/**
 * Inline matnni (inline code, bold, links, images) xavfsiz render qilish.
 * Xom HTML umuman bajarilmaydi, faqat React text sifatida ko'rsatiladi.
 */
export function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Tokenlar: rasm ![alt](src), havola [text](url), inline code `code`, bold **text**
  const regex = /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];

    // Rasm: ![alt](src)
    if (token.startsWith("![") && token.includes("](") && token.endsWith(")")) {
      const alt = token.slice(2, token.indexOf("]("));
      const src = token.slice(token.indexOf("](") + 2, -1).trim();

      if (isSafeImageUrl(src)) {
        parts.push(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`img-${match.index}`}
            src={src}
            alt={alt}
            style={{
              maxWidth: "100%",
              borderRadius: 8,
              border: "1px solid #1e293b",
              margin: "8px 0",
            }}
          />
        );
      } else {
        // Xavfli yoki taqiqlangan rasm manbasi — rasm o'rniga ogohlantirish
        parts.push(
          <span
            key={`img-unsafe-${match.index}`}
            style={{
              fontSize: "0.82rem",
              color: "#ef4444",
              background: "rgba(239,68,68,0.1)",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            [Ruxsat etilmagan rasm: {alt || "image"}]
          </span>
        );
      }
    }
    // Havola: [text](url)
    else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkText = token.slice(1, token.indexOf("]("));
      const url = token.slice(token.indexOf("](") + 2, -1).trim();

      if (isSafeUrl(url)) {
        const isExternal = url.startsWith("http://") || url.startsWith("https://");
        parts.push(
          <a
            key={`a-${match.index}`}
            href={url}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            style={{
              color: "#38bdf8",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {linkText}
          </a>
        );
      } else {
        // Xavfli havola (masalan, javascript: yoki data:) bloklanadi
        parts.push(
          <span
            key={`a-unsafe-${match.index}`}
            style={{
              color: "#ef4444",
              textDecoration: "line-through",
              cursor: "not-allowed",
            }}
            title="Xavfsizlik sababli taqiqlangan havola"
          >
            {linkText}
          </span>
        );
      }
    }
    // Inline code: `code`
    else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={`code-${match.index}`}
          style={{
            background: "rgba(56, 189, 248, 0.12)",
            color: "#38bdf8",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: "0.85em",
            fontFamily: "'JetBrains Mono', Consolas, monospace",
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    // Bold: **text**
    else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`bold-${match.index}`} style={{ color: "#f1f5f9" }}>
          {token.slice(2, -2)}
        </strong>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
