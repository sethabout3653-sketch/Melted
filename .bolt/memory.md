# Project memory

## Product intent & audience

- Scramjet-based web proxy/unblocker app (Vite + React frontend) intended to access Google, YouTube, and Cloudflare-protected sites without bot-check blocks.
- Deploys across two surfaces: Cloudflare Worker (`worker/index.ts`) for API routing + WebSocket signaling hub, and a Node/Express backend (`server.ts`) hosting the Wisp server at `/wisp/`.

## Brand personality & voice

- User prefers minimal, surgical changes ("dont mess up anything else just do this").
- Respond directly about blockers; do not assume code exists without checking.

## Visual design & UX direction

- Not yet inferred from this turn; no UI/styling decisions discussed.

## Decisions, constraints & rationale

- Client transport is already `@mercuryworkshop/epoxy-transport` (not libcurl). Do not switch — already done.
- Wisp server lives in Node backend (`@mercuryworkshop/wisp-js/server`, mounted `/wisp/`), NOT in the Cloudflare Worker. The Worker currently only routes API endpoints + WS signaling hub; it has no `connect()` or Wisp handler.
- On static `.pages.dev` hosting, client falls back to public Wisp servers (e.g. `anura.pro`).
- Backend already has Webshare proxy slots available for outbound routing.
- Root cause of bot checks: Cloudflare Worker exit IPs (AS13335) are auto-flagged by Google/YouTube; header/code changes alone won't fix IP-based blocks.
- Proposed split-routing: route only `*.youtube.com`, `*.googlevideo.com`, `*.google.com`, `*.gstatic.com`, and known CF-protected domains via upstream SOCKS5; let all other traffic exit directly to preserve speed and proxy bandwidth.
- Preserve real User-Agent and `Sec-CH-UA` client hints; do not strip/spoof mismatched headers.

## Open questions & assumptions

- User assumed the Worker's `connect()` exists; it does not. Awaiting decision between:
  1. Add SOCKS5 split-routing to the Node Wisp server (`server.ts`) — smallest, safest change.
  2. Build a new Wisp server inside the Cloudflare Worker using `cloudflare:sockets` `connect()` with SOCKS5 upstream routing.
- No SOCKS5 host/port/credentials provided yet; unclear whether to hardcode or use env vars.
- Specific YouTube error symptoms not confirmed (bot-check screen vs. infinite buffering) — user described goals rather than current failures.