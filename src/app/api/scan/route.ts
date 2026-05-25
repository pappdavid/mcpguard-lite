import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { buildMcpScanReport } from "@/lib/mcp-scan-report";
import { trackSecurityEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { input?: string };
  try {
    body = (await request.json()) as { input?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { input } = body;
  if (!input || typeof input !== "string") {
    return NextResponse.json({ error: "Missing required field: input" }, { status: 400 });
  }

  const dbUser = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId, email: `${clerkId}@clerk.dev` },
  });
  const userId = dbUser.id;

  const result = buildMcpScanReport(input);

  const scan = await prisma.mcpScan.create({
    data: {
      userId,
      input,
      safe: result.safe,
      detectedPatterns: result.detectedPatterns,
      severity: result.severity,
      aiRiskSummary: result.summary,
    },
  });

  await trackSecurityEvent({
    type: "mcp_scan_completed",
    userId,
    severity: result.severity,
    details: {
      scanId: scan.id,
      safe: result.safe,
      toolCount: result.report.toolCount,
      riskyCapabilityCount: result.report.riskyCapabilities.length,
      missingControlCount: result.report.missingControls.length,
    },
  });

  return NextResponse.json({
    scanId: scan.id,
    safe: result.safe,
    severity: result.severity,
    detectedPatterns: result.detectedPatterns,
    summary: result.summary,
    report: result.report,
  });
}
