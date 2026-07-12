export type ToolsListSeverity = "low" | "medium" | "high" | "critical";

export interface RiskyCapability {
  toolName: string;
  category:
    | "command_execution"
    | "filesystem_write"
    | "filesystem_read"
    | "network_access"
    | "secret_access"
    | "database_access"
    | "approval_bypass";
  severity: ToolsListSeverity;
  reason: string;
}

export interface ToolsListReport {
  valid: boolean;
  severity: ToolsListSeverity;
  toolCount: number;
  riskyCapabilities: RiskyCapability[];
  missingControls: string[];
  summary: string;
  error?: string;
}

type ToolLike = {
  name?: unknown;
  description?: unknown;
  inputSchema?: unknown;
};

const capabilityRules: Array<{
  category: RiskyCapability["category"];
  severity: ToolsListSeverity;
  pattern: RegExp;
  reason: string;
}> = [
  {
    category: "command_execution",
    severity: "critical",
    pattern: /\b(shell|exec|command|process|terminal|script|bash|powershell)\b/i,
    reason: "Tool can execute commands or scripts.",
  },
  {
    category: "filesystem_write",
    severity: "high",
    pattern: /\b(write|delete|remove|move|rename|chmod|upload|create file)\b/i,
    reason: "Tool can mutate files or directories.",
  },
  {
    category: "filesystem_read",
    severity: "medium",
    pattern: /\b(read file|download|list files|filesystem|path)\b/i,
    reason: "Tool can read local files or enumerate paths.",
  },
  {
    category: "network_access",
    severity: "medium",
    pattern: /\b(http|fetch|request|webhook|url|network|socket)\b/i,
    reason: "Tool can send or retrieve network data.",
  },
  {
    category: "secret_access",
    severity: "critical",
    pattern: /\b(secret|token|api key|credential|env|password)\b/i,
    reason: "Tool can access credentials or environment secrets.",
  },
  {
    category: "database_access",
    severity: "high",
    pattern: /\b(sql|database|query|table|postgres|neon|delete rows?)\b/i,
    reason: "Tool can access or mutate database state.",
  },
  {
    category: "approval_bypass",
    severity: "high",
    pattern: /\b(approve|bypass|override|without approval|auto.?approve)\b/i,
    reason: "Tool can affect approval controls.",
  },
];

const controlDeclarations = {
  approval:
    /\b(?:requires?|uses?|enforces?|mandatory)\s+(?:human\s+)?(?:approval|review)\b|\b(?:approval|review)\s+(?:is\s+)?(?:required|enabled|enforced|mandatory)\b/i,
  audit:
    /\b(?:emits?|records?|writes?|retains?)\s+(?:audit\s+)?(?:logs?|events?|traces?)\b|\b(?:audit logging|tracing)\s+(?:is\s+)?(?:enabled|required|retained|enforced)\b/i,
  filesystem:
    /\b(?:filesystem\s+)?(?:allowlist|sandbox|read.?only scope)\s+(?:is\s+)?(?:enabled|required|enforced|restricted)\b|\b(?:restricts?|scopes?)\s+(?:filesystem|file access)\b/i,
  network:
    /\b(?:domain allowlist|egress controls?|allowed domains?)\s+(?:is|are)?\s*(?:enabled|required|enforced|configured)\b|\b(?:restricts?|allowlists?)\s+(?:network|egress|domains?)\b/i,
};

const rank: Record<ToolsListSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function normalizeTools(value: unknown): ToolLike[] | null {
  if (Array.isArray(value)) return value as ToolLike[];
  if (value && typeof value === "object" && Array.isArray((value as { tools?: unknown }).tools)) {
    return (value as { tools: ToolLike[] }).tools;
  }
  return null;
}

function toolText(tool: ToolLike) {
  return [tool.name, tool.description, JSON.stringify(tool.inputSchema ?? {})]
    .filter((part): part is string => typeof part === "string")
    .join(" ");
}

function getSeverity(capabilities: RiskyCapability[]): ToolsListSeverity {
  return capabilities.reduce<ToolsListSeverity>(
    (highest, capability) =>
      rank[capability.severity] > rank[highest] ? capability.severity : highest,
    "low"
  );
}

export function analyzeToolsList(rawJson: string): ToolsListReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      valid: false,
      severity: "high",
      toolCount: 0,
      riskyCapabilities: [],
      missingControls: [],
      summary: "Invalid JSON. Paste the raw MCP tools/list response.",
      error: "Invalid JSON",
    };
  }

  const tools = normalizeTools(parsed);
  if (!tools) {
    return {
      valid: false,
      severity: "high",
      toolCount: 0,
      riskyCapabilities: [],
      missingControls: [],
      summary: "Expected a tools array or an object with a tools array.",
      error: "Missing tools array",
    };
  }

  const riskyCapabilities = tools.flatMap((tool) => {
    const text = toolText(tool);
    const toolName = typeof tool.name === "string" ? tool.name : "unnamed_tool";
    return capabilityRules
      .filter((rule) => rule.pattern.test(text))
      .map((rule) => ({
        toolName,
        category: rule.category,
        severity: rule.severity,
        reason: rule.reason,
      }));
  });

  const hasHighRisk = riskyCapabilities.some((capability) => rank[capability.severity] >= rank.high);
  const missingControls: string[] = [];
  if (hasHighRisk && !controlDeclarations.approval.test(rawJson)) {
    missingControls.push("human approval for high-risk tools");
  }
  if (riskyCapabilities.length > 0 && !controlDeclarations.audit.test(rawJson)) {
    missingControls.push("audit logging");
  }
  if (
    riskyCapabilities.some((capability) => capability.category.includes("filesystem")) &&
    !controlDeclarations.filesystem.test(rawJson)
  ) {
    missingControls.push("filesystem allowlist or sandbox");
  }
  if (
    riskyCapabilities.some((capability) => capability.category === "network_access") &&
    !controlDeclarations.network.test(rawJson)
  ) {
    missingControls.push("network egress allowlist");
  }

  const baseSeverity = getSeverity(riskyCapabilities);
  const severity = baseSeverity === "high" && missingControls.length >= 2 ? "critical" : baseSeverity;

  return {
    valid: true,
    severity,
    toolCount: tools.length,
    riskyCapabilities,
    missingControls,
    summary:
      riskyCapabilities.length === 0
        ? `${tools.length} tool${tools.length === 1 ? "" : "s"} parsed. No risky capabilities detected.`
        : `${riskyCapabilities.length} risky capability finding${riskyCapabilities.length === 1 ? "" : "s"} across ${tools.length} tool${tools.length === 1 ? "" : "s"}.`,
  };
}
