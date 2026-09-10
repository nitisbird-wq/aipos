export function safeInternalReturnPath(value: string | null | undefined, fallback = "/intake") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const parsed = new URL(value, "http://aipos.local");
    if (parsed.origin !== "http://aipos.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
