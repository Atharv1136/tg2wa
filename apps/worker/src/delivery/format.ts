import { MAX_MESSAGE_PART_LENGTH } from "@tg2wa/shared";

export interface FormatOptions {
  groupTitle: string;
  senderName?: string | null;
  includeSenderName?: boolean;
  hasMedia?: boolean;
}

/**
 * Formats a message according to PRD section 9:
 * 📩 {Group title}
 * 👤 {Sender name}   (omit line if disabled or empty)
 *
 * {message text}
 */
export function formatMessage(text: string, options: FormatOptions): string {
  const parts: string[] = [];
  parts.push(`📩 ${options.groupTitle}`);

  if (options.includeSenderName !== false && options.senderName) {
    parts.push(`👤 ${options.senderName}`);
  }

  let body = text.trim();
  if (options.hasMedia) {
    body += " 📎 (media not forwarded)";
  }

  return `${parts.join("\n")}\n\n${body}`;
}

/**
 * Splits text into parts <= MAX_MESSAGE_PART_LENGTH (1500 chars),
 * appending (1/n) suffixes when split.
 */
export function splitMessage(text: string, maxLength = MAX_MESSAGE_PART_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  // Rough estimation of chunks count
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try finding a clean break point (newline or space) near maxLength
    let breakPoint = remaining.lastIndexOf("\n", maxLength - 20);
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(" ", maxLength - 20);
    }
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = maxLength - 20; // fallback hard break
    }

    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  const total = chunks.length;
  return chunks.map((chunk, index) => `${chunk}\n\n(${index + 1}/${total})`);
}
