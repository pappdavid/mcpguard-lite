"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";

interface ScanResult {
  scanId: string;
  safe: boolean;
  severity: string;
  summary?: string;
  detectedPatterns?: string[];
  report?: {
    valid: boolean;
    toolCount: number;
    riskyCapabilities: Array<{
      toolName: string;
      category: string;
      severity: string;
      reason: string;
    }>;
    missingControls: string[];
    error?: string;
  };
  error?: string;
}

export default function ScanForm() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = (await res.json()) as ScanResult;
      if (!res.ok) {
        setError(data.error ?? "Scan failed");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-sm">Analyze MCP tools/list JSON</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste a raw tools/list response to detect risky capabilities and missing controls.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Raw tools/list JSON
          </label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[180px] resize-y"
            placeholder='{"tools":[{"name":"shell.exec","description":"Run shell commands","inputSchema":{"type":"object"}}]}'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`rounded-md border px-4 py-3 space-y-2 ${result.safe ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
        >
          <div className="flex items-center gap-2 font-medium text-sm">
            {result.safe ? (
              <ShieldCheck className="h-4 w-4 text-green-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-red-600" />
            )}
            <span className={result.safe ? "text-green-700" : "text-red-700"}>
              {result.safe
                ? "No risky capabilities detected"
                : "Review required for risky MCP capabilities"}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Severity: <span className="font-medium capitalize">{result.severity}</span>
            {typeof result.report?.toolCount === "number" ? ` - ${result.report.toolCount} tools parsed` : ""}
          </p>

          {result.summary && (
            <p className="text-xs text-muted-foreground">{result.summary}</p>
          )}

          {(result.report?.riskyCapabilities.length ?? 0) > 0 && (
            <div className="text-xs">
              <p className="font-medium text-muted-foreground mb-1">Risky capabilities:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {result.report?.riskyCapabilities.map((capability, i) => (
                  <li key={`${capability.toolName}-${capability.category}-${i}`}>
                    {capability.toolName}: {capability.category.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(result.report?.missingControls.length ?? 0) > 0 && (
            <div className="text-xs">
              <p className="font-medium text-muted-foreground mb-1">Missing controls:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {result.report?.missingControls.map((control) => (
                  <li key={control}>{control}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground/60">Scan ID: {result.scanId}</p>
        </div>
      )}
    </div>
  );
}
