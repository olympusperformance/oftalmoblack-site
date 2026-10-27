// Missing deployment configuration must never turn a private MCP public.
export function authorized(req, token, headerNames) {
  if (typeof token !== "string" || !token.trim()) return false;
  const fromUrl = new URL(req.url).searchParams.get("k");
  return (
    fromUrl === token ||
    headerNames.some(
      (name) =>
        (req.headers.get(name) || "").replace(/^Bearer\s+/i, "") === token,
    )
  );
}
