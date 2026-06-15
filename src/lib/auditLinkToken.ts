import { createHmac, timingSafeEqual } from "node:crypto";

function getAuditLinkSecret() {
  return (
    process.env.AUDIT_EXPORT_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ""
  );
}

export function createAuditLinkToken(auditLogId: string) {
  const secret = getAuditLinkSecret();

  if (!secret) return "";

  return createHmac("sha256", secret).update(auditLogId).digest("hex");
}

export function verifyAuditLinkToken(auditLogId: string, token?: string | null) {
  const expectedToken = createAuditLinkToken(auditLogId);

  if (!expectedToken || !token) return false;

  try {
    const expectedBuffer = Buffer.from(expectedToken, "hex");
    const actualBuffer = Buffer.from(token, "hex");

    if (expectedBuffer.length !== actualBuffer.length) return false;

    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}
