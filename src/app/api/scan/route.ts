import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { scanPromptForInjection } from "@/lib/prompt-guard";
import { assessRisk } from "@/lib/ai";
import { trackSecurityEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { input?: string; tool?: string };
  try {
    body = (await request.json()) as { input?: string; tool?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { input, tool = "scan_prompt" } = body;
  if (!input || typeof input !== "string") {
    return NextResponse.json({ error: "Missing required field: input" }, { status: 400 });
  }

  const dbUser = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId, email: `${clerkId}@clerk.dev` },
  });
  const userId = dbUser.id;

  if (tool === "assess_risk") {
    const guard = scanPromptForInjection(input);
    const aiResult = await assessRisk(input);

    const scan = await prisma.mcpScan.create({
      data: {
        userId: userId ?? null,
        input,
        safe: guard.safe && aiResult.riskLevel === "low",
        detectedPatterns: [...guard.detectedPatterns, ...aiResult.threats],
        severity: aiResult.riskLevel,
        aiRiskSummary: aiResult.summary,
      },
    });

    await trackSecurityEvent({
      type: "agent_risk_assessed",
      userId,
      severity: aiResult.riskLevel,
      details: { scanId: scan.id, riskLevel: aiResult.riskLevel, threats: aiResult.threats },
    });

    return NextResponse.json({
      scanId: scan.id,
      safe: scan.safe,
      riskLevel: aiResult.riskLevel,
      threats: aiResult.threats,
      summary: aiResult.summary,
    });
  }

  // Default: scan_prompt (fast regex scan)
  const guard = scanPromptForInjection(input);
  const severity = guard.safe ? "low" : "high";

  const scan = await prisma.mcpScan.create({
    data: {
      userId: userId ?? null,
      input,
      safe: guard.safe,
      detectedPatterns: guard.detectedPatterns,
      severity,
    },
  });

  await trackSecurityEvent({
    type: guard.safe ? "mcp_scan_completed" : "prompt_injection_detected",
    userId,
    severity: guard.safe ? "low" : "high",
    details: { scanId: scan.id, patternsCount: guard.detectedPatterns.length },
  });

  return NextResponse.json({
    scanId: scan.id,
    safe: guard.safe,
    detectedPatterns: guard.detectedPatterns,
    severity,
  });
}
