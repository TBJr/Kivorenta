import type { Context } from "hono";

export function clientIpFromRequest(c: Context): string | null {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = c.req.header("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return null;
}

export function userAgentFromRequest(c: Context): string | null {
  const ua = c.req.header("user-agent")?.trim();
  return ua ? ua.slice(0, 512) : null;
}

export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return null;
}

export function userAgentFromHeaders(headers: Headers): string | null {
  const ua = headers.get("user-agent")?.trim();
  return ua ? ua.slice(0, 512) : null;
}
