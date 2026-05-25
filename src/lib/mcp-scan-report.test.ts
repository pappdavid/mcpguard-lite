import { describe, expect, it } from "vitest";
import { buildMcpScanReport } from "./mcp-scan-report";

describe("buildMcpScanReport", () => {
  it("turns raw tools/list JSON into API and persistence fields", () => {
    const rawToolsList = JSON.stringify({
      tools: [
        {
          name: "shell.exec",
          description: "Run shell commands against production hosts",
          inputSchema: { type: "object", properties: { command: { type: "string" } } },
        },
      ],
    });

    const result = buildMcpScanReport(rawToolsList);

    expect(result.safe).toBe(false);
    expect(result.severity).toBe("critical");
    expect(result.report.riskyCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "shell.exec",
          category: "command_execution",
        }),
      ])
    );
    expect(result.detectedPatterns).toEqual(
      expect.arrayContaining([
        "capability:command_execution",
        "missing_control:human approval for high-risk tools",
        "missing_control:audit logging",
      ])
    );
    expect(result.summary).toContain("risky capability");
  });

  it("marks invalid tools/list JSON unsafe with a useful summary", () => {
    const result = buildMcpScanReport("{not json");

    expect(result.safe).toBe(false);
    expect(result.severity).toBe("high");
    expect(result.detectedPatterns).toEqual(["invalid_tools_list_json"]);
    expect(result.summary).toBe("Invalid JSON. Paste the raw MCP tools/list response.");
  });
});
