/**
 * Tracks last inbound event timestamps for status/health APIs.
 */
let lastGmailInboundAt: string | null = null;

export function getLastGmailInboundAt(): string | null {
  return lastGmailInboundAt;
}

export function setLastGmailInboundAt(): void {
  lastGmailInboundAt = new Date().toISOString();
}
