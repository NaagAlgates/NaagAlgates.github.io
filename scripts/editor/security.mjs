// Request gate for the local blog editor endpoint. Pure predicates — no
// server imports — so the whole policy is unit-testable.
//
// Policy (from the agreed plan, D7):
//   1. Remote socket address must be loopback (covers `astro dev --host`).
//   2. Host header authority must be a loopback name with the server's
//      actually bound port (covers DNS rebinding).
//   3. POST additionally requires a loopback Origin (mandatory) and the
//      custom X-Blog-Editor: 1 header (forces a CORS preflight cross-origin,
//      which can never succeed because no CORS headers are ever emitted).

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const EDITOR_HEADER = "x-blog-editor";
export const EDITOR_HEADER_VALUE = "1";

export function isLoopbackAddress(addr) {
  if (typeof addr !== "string" || addr.length === 0) return false;
  if (addr === "::1") return true;
  const v4 = addr.startsWith("::ffff:") ? addr.slice(7) : addr;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4);
}

/** Parse an authority ("host:port", "[::1]:port", bare host) into parts. */
export function parseAuthority(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const m = value.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
  if (!m) return null;
  return { hostname: m[1].toLowerCase(), port: m[2] ? Number(m[2]) : null };
}

export function isAllowedAuthority(value, boundPort) {
  const auth = parseAuthority(value);
  if (!auth || !Number.isInteger(boundPort)) return false;
  return LOOPBACK_HOSTNAMES.has(auth.hostname) && auth.port === boundPort;
}

export function isAllowedOrigin(origin, boundPort) {
  if (typeof origin !== "string") return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:") return false;
  const hostname =
    url.hostname.includes(":") && !url.hostname.startsWith("[")
      ? `[${url.hostname}]`
      : url.hostname;
  const port = url.port ? Number(url.port) : 80;
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase()) && port === boundPort;
}

/**
 * @param {object} meta
 * @param {string} meta.method
 * @param {string|undefined} meta.remoteAddress
 * @param {string|undefined} meta.host        Host header
 * @param {string|undefined} meta.origin      Origin header
 * @param {string|string[]|undefined} meta.editorHeader X-Blog-Editor value
 * @param {number|undefined} meta.boundPort   actual bound port of the server
 * @returns {{allowed: boolean, status?: number, reason?: string}}
 */
export function checkRequest(meta) {
  const deny = (reason) => ({ allowed: false, status: 403, reason });

  if (!Number.isInteger(meta.boundPort))
    return deny("server bound port unknown");
  if (!isLoopbackAddress(meta.remoteAddress))
    return deny("editor is only available from this machine (loopback)");
  if (!isAllowedAuthority(meta.host, meta.boundPort))
    return deny("Host header is not this server's loopback authority");

  if (meta.method === "POST") {
    if (!isAllowedOrigin(meta.origin, meta.boundPort))
      return deny("Origin header missing or not this server's loopback origin");
    if (meta.editorHeader !== EDITOR_HEADER_VALUE)
      return deny(`${EDITOR_HEADER} header must be ${EDITOR_HEADER_VALUE}`);
  }

  return { allowed: true };
}
