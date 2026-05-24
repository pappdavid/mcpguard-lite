import { prisma } from "./db";
import { Prisma } from "@prisma/client";

export type SecurityEventType =
  | "prompt_injection_detected"
  | "mcp_scan_completed"
  | "agent_risk_assessed"
  | "auth_failure";

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  severity: "low" | "medium" | "high" | "critical";
  details: Record<string, unknown>;
  timestamp: string;
}

export async function trackSecurityEvent(
  event: Omit<SecurityEvent, "timestamp">
): Promise<void> {
  const full: SecurityEvent = { ...event, timestamp: new Date().toISOString() };

  if (process.env.NODE_ENV !== "production") {
    console.log("[security-analytics]", JSON.stringify(full));
  }

  try {
    await prisma.securityEvent.create({
      data: {
        type: full.type,
        severity: full.severity,
        details: full.details as Prisma.InputJsonValue,
        userId: full.userId ?? null,
        timestamp: new Date(full.timestamp),
      },
    });
  } catch (err) {
    // Non-fatal: log but don't block the request
    console.error("[security-analytics] failed to persist event", err);
  }
}
