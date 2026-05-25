import { analyzeToolsList, type ToolsListReport, type ToolsListSeverity } from "./tools-list-report";

export interface McpScanReportResult {
  safe: boolean;
  severity: ToolsListSeverity;
  report: ToolsListReport;
  detectedPatterns: string[];
  summary: string;
}

export function buildMcpScanReport(input: string): McpScanReportResult {
  const report = analyzeToolsList(input);
  const detectedPatterns = report.valid
    ? [
        ...new Set([
          ...report.riskyCapabilities.map((capability) => `capability:${capability.category}`),
          ...report.missingControls.map((control) => `missing_control:${control}`),
        ]),
      ]
    : ["invalid_tools_list_json"];

  return {
    safe: report.valid && report.riskyCapabilities.length === 0 && report.missingControls.length === 0,
    severity: report.severity,
    report,
    detectedPatterns,
    summary: report.summary,
  };
}
