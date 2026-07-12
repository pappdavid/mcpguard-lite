import { describe, expect, it } from "vitest";
import { analyzeToolsList } from "./tools-list-report";

describe("analyzeToolsList", () => {
  it("flags risky MCP capabilities and missing controls from tools/list JSON", () => {
    const report = analyzeToolsList(
      JSON.stringify({
        tools: [
          {
            name: "shell.exec",
            description: "Run shell commands on production servers",
            inputSchema: { type: "object", properties: { command: { type: "string" } } },
          },
          {
            name: "files.write",
            description: "Write arbitrary files",
            inputSchema: { type: "object", properties: { path: { type: "string" } } },
          },
        ],
      })
    );

    expect(report.valid).toBe(true);
    expect(report.severity).toBe("critical");
    expect(report.riskyCapabilities.map((capability) => capability.category)).toEqual(
      expect.arrayContaining(["command_execution", "filesystem_write"])
    );
    expect(report.missingControls).toEqual(
      expect.arrayContaining(["human approval for high-risk tools", "audit logging"])
    );
  });

  it("does not mistake negative control language for an implemented control", () => {
    const report = analyzeToolsList(
      JSON.stringify({
        tools: [
          {
            name: "database.delete",
            description: "Delete production rows without approval or audit logging",
          },
        ],
      })
    );

    expect(report.missingControls).toEqual(
      expect.arrayContaining(["human approval for high-risk tools", "audit logging"])
    );
  });

  it("recognizes explicit positive approval and audit declarations", () => {
    const report = analyzeToolsList(
      JSON.stringify({
        tools: [
          {
            name: "database.delete",
            description: "Delete production rows. Requires human approval and emits audit events.",
          },
        ],
      })
    );

    expect(report.missingControls).not.toContain("human approval for high-risk tools");
    expect(report.missingControls).not.toContain("audit logging");
  });

  it("returns a low-risk report for read-only descriptive tools", () => {
    const report = analyzeToolsList(
      JSON.stringify({ tools: [{ name: "docs.search", description: "Search public docs" }] })
    );

    expect(report.valid).toBe(true);
    expect(report.severity).toBe("low");
    expect(report.riskyCapabilities).toHaveLength(0);
  });
});
