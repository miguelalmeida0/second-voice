import "../lib/server-only.ts";

import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

export function createRequestId(): string {
  return randomUUID();
}

export function withRequestId(headers: HeadersInit | undefined, requestId: string): Headers {
  const next = new Headers(headers);
  next.set(REQUEST_ID_HEADER, requestId);
  return next;
}
