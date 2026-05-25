import { NextRequest, NextResponse } from "next/server";
import { buildMcpScanReport } from "@/lib/mcp-scan-report";
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

// Tool: analyze_tools_list — deterministic MCP tools/list analysis
async function toolAnalyzeToolsList(params: Record<string, unknown>, userId?: string) {
  const input = typeof params.input === "string" ? params.input : "";
  if (!input) {
    return { error: "Missing required param: input" };
  }
  const dbUserId = await resolveDbUserId(userId);
  if (!dbUserId) {
    return { error: "Missing required field: userId" };
  }
  const result = buildMcpScanReport(input);

  const scan = await prisma.mcpScan.create({
    data: {
      userId: dbUserId,
      input,
      safe: result.safe,
      detectedPatterns: result.detectedPatterns,
      severity: result.severity,
      aiRiskSummary: result.summary,
    },
  });

  await trackSecurityEvent({
    type: "mcp_scan_completed",
    userId: dbUserId ?? undefined,
    severity: result.severity,
    details: {
      scanId: scan.id,
      safe: result.safe,
      toolCount: result.report.toolCount,
      riskyCapabilityCount: result.report.riskyCapabilities.length,
      missingControlCount: result.report.missingControls.length,
    },
  });

  return {
    scanId: scan.id,
    safe: result.safe,
    severity: result.severity,
    detectedPatterns: result.detectedPatterns,
    summary: result.summary,
    report: result.report,
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
    reportsRequiringReview: unsafe,
    safeScans: total - unsafe,
    bySeverity: Object.fromEntries(
      bySeverity.map((r) => [r.severity, r._count])
    ),
  };
}

const TOOLS = {
  analyze_tools_list: {
    description: "Analyze raw MCP tools/list JSON for risky capabilities and missing controls.",
    params: { input: "string — the raw MCP tools/list JSON response" },
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

  switch (tool) {
    case "analyze_tools_list":
      return NextResponse.json(await toolAnalyzeToolsList(params, userId));
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
