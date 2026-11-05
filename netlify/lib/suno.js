// Shared helpers for talking to sunoapi.org. The API key lives only in the
// SUNO_API_KEY environment variable (set it in Netlify > Site configuration >
// Environment variables) and never reaches the browser.
export const SUNO_BASE = process.env.SUNO_API_BASE || "https://api.sunoapi.org";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function callbackUrl(req) {
  // Suno requires a callBackUrl. We poll for status anyway, so this endpoint
  // simply acknowledges the notification.
  const base = process.env.URL || new URL(req.url).origin;
  return `${base}/.netlify/functions/callback`;
}

export async function suno(path, { method = "GET", body } = {}) {
  const key = process.env.SUNO_API_KEY;
  if (!key) {
    return { code: 500, msg: "Server is missing SUNO_API_KEY. Add it in Netlify environment variables." };
  }
  const res = await fetch(`${SUNO_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { code: res.status, msg: text.slice(0, 300) || res.statusText };
  }
}

export const ERROR_HINTS = {
  400: "Invalid parameters.",
  401: "Unauthorized — check the SUNO_API_KEY.",
  405: "Rate limit exceeded — wait a moment.",
  413: "Prompt or lyrics too long.",
  429: "Insufficient credits on your sunoapi.org account.",
  430: "Too many requests — try again shortly.",
  455: "Suno API is under maintenance.",
  500: "Suno server error.",
};
