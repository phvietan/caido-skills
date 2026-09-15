export function canonicalUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.replace(
    /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]+)/,
    (authority) => authority.toLowerCase(),
  );
}
