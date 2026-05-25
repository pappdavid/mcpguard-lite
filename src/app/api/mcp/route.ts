import { NextRequest, NextResponse } from "next/server";
import { scanPromptForInjection } from "@/lib/prompt-guard";
import { assessRisk } from "@/lib/ai";
import { wrapAiOutput } from "@/lib/ai-output";
import { trackSecurityEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";

function verifyMcpSecret(request: NextRequest): boolean {
  const secret = process.env.MCP_API_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

interface McpToolCall {
  tool: string;
  params?: Record<string, unknown>;
  userId?: string;
}

async function resolveDbUserId(clerkUserId?: string) {
  if (!clerkUserId) {
    return null;
  }

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUserId },
    update: {},
    create: { clerkId: clerkUserId, email: `${clerkUserId}@clerk.dev` },
    select: { id: true },
  });

  return user.id;
}

// Tool: scan_prompt — fast regex-based injection detection
async function toolScanPrompt(params: Record<string, unknown>, userId?: string) {
  const input = typeof params.input === "string" ? params.input : "";
  if (!input) {
    return { error: "Missing required param: input" };
  }

  const dbUserId = await resolveDbUserId(userId);
  const guard = scanPromptForInjection(input);
  const severity = guard.safe ? "low" : "high";

  const scan = await prisma.mcpScan.create({
    data: {
      userId: dbUserId,
      input,
      safe: guard.safe,
      detectedPatterns: guard.detectedPatterns,
      severity,
    },
  });

  await trackSecurityEvent({
    type: guard.safe ? "mcp_scan_completed" : "prompt_injection_detected",
    userId: dbUserId ?? undefined,
    severity: guard.safe ? "low" : "high",
    details: { scanId: scan.id, patternsCount: guard.detectedPatterns.length },
  });

  return {
    scanId: scan.id,
    safe: guard.safe,
    detectedPatterns: guard.detectedPatterns,
    severity,
  };
}

// Tool: assess_risk — AI-powered deep risk analysis
async function toolAssessRisk(params: Record<string, unknown>, userId?: string) {
  const input = typeof params.input === "string" ? params.input : "";
  if (!input) {
    return { error: "Missing required param: input" };
  }

  const dbUserId = await resolveDbUserId(userId);
  const guard = scanPromptForInjection(input);
  const aiResult = await assessRisk(input);
  const output = wrapAiOutput(aiResult.summary, "gpt-4o-mini", {
    flagged: !guard.safe,
    reason: guard.detectedPatterns.join(", ") || undefined,
  });

  const scan = await prisma.mcpScan.create({
    data: {
      userId: dbUserId,
      input,
      safe: guard.safe && aiResult.riskLevel === "low",
      detectedPatterns: [...guard.detectedPatterns, ...aiResult.threats],
      severity: aiResult.riskLevel,
      aiRiskSummary: aiResult.summary,
    },
  });

  await trackSecurityEvent({
    type: "agent_risk_assessed",
    userId: dbUserId ?? undefined,
    severity: aiResult.riskLevel,
    details: {
      scanId: scan.id,
      riskLevel: aiResult.riskLevel,
      threats: aiResult.threats,
    },
  });

  return {
    scanId: scan.id,
    safe: output.safe,
    riskLevel: aiResult.riskLevel,
    threats: aiResult.threats,
    summary: aiResult.summary,
  };
}

// Tool: get_stats — aggregate security metrics
async function toolGetStats(userId?: string) {
  const dbUserId = await resolveDbUserId(userId);
  if (!dbUserId) {
    return { error: "Missing required param: userId" };
  }

  const where = { userId: dbUserId };

  const [total, unsafe, bySeverity] = await Promise.all([
    prisma.mcpScan.count({ where }),
    prisma.mcpScan.count({ where: { ...where, safe: false } }),
    prisma.mcpScan.groupBy({ by: ["severity"], where, _count: true }),
  ]);

  return {
    totalScans: total,
    threatsDetected: unsafe,
    safeScans: total - unsafe,
    bySeverity: Object.fromEntries(
      bySeverity.map((r) => [r.severity, r._count])
    ),
  };
}

const TOOLS = {
  scan_prompt: {
    description: "Scan an agent input string for prompt injection attacks.",
    params: { input: "string — the raw agent input to scan" },
  },
  assess_risk: {
    description: "Deep AI-powered risk assessment of an agent input.",
    params: { input: "string — the raw agent input to assess" },
  },
  get_stats: {
    description: "Retrieve aggregate security scan statistics.",
    params: {},
  },
};

export async function POST(request: NextRequest) {
  if (!verifyMcpSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: McpToolCall;
  try {
    body = (await request.json()) as McpToolCall;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tool, params = {}, userId } = body;

  console.log("[mcp] tool call", tool, params);

  switch (tool) {
    case "scan_prompt":
      return NextResponse.json(await toolScanPrompt(params, userId));
    case "assess_risk":
      return NextResponse.json(await toolAssessRisk(params, userId));
    case "get_stats":
      return NextResponse.json(await toolGetStats(userId));
    default:
      return NextResponse.json(
        { error: `Unknown tool: ${tool}`, availableTools: Object.keys(TOOLS) },
        { status: 400 }
      );
  }
}

export async function GET() {
  return NextResponse.json({
    product: "mcpguard-lite",
    mcp: true,
    tools: Object.entries(TOOLS).map(([name, meta]) => ({ name, ...meta })),
  });
}
