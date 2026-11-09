/**
 * Origin-wide favicon: nginx sends every /favicon.ico request to web-portal, so
 * this route answers for the portal and all role consoles sharing the host.
 * Inline SVG keeps the response tiny and independent of the standalone bundle.
 */
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="url(#g)"/><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><text x="32" y="43" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#fff">Н</text></svg>`;

export function GET() {
  return new Response(icon, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Content-Type': 'image/svg+xml',
    },
  });
}
