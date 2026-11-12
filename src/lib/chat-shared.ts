// Browser-safe helpers shared by the chat route, server functions and UI.

export const ATTACHMENT_BUCKET = "chat-attachments";
export const STORAGE_PREFIX = "storage:";
export const DEFAULT_THREAD_TITLE = "محادثة جديدة";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 4;
export const ACCEPTED_ATTACHMENTS =
  "image/*,application/pdf,text/plain,text/markdown,text/csv,.md,.csv,.txt";

export function isAcceptedMediaType(mediaType: string): boolean {
  return (
    mediaType.startsWith("image/") ||
    mediaType === "application/pdf" ||
    mediaType === "text/plain" ||
    mediaType === "text/markdown" ||
    mediaType === "text/csv"
  );
}

/** Turns the first user text into a short thread title. */
export function titleFromText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return DEFAULT_THREAD_TITLE;
  return clean.length > 48 ? `${clean.slice(0, 48).trimEnd()}…` : clean;
}

export type StoredPart =
  | { type: "text"; text: string }
  | { type: "file"; mediaType: string; url: string; filename?: string };