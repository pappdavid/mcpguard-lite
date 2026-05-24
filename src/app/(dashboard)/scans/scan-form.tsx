"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";

interface ScanResult {
  scanId: string;
  safe: boolean;
  detectedPatterns?: string[];
  riskLevel?: string;
  threats?: string[];
  summary?: string;
  severity?: string;
  error?: string;
}

export default function ScanForm() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"scan_prompt" | "assess_risk">("scan_prompt");
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
        body: JSON.stringify({ input, tool: mode }),
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
      <h2 className="font-semibold text-sm">Quick Scan</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Agent input to scan
          </label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y"
            placeholder="Paste an agent prompt or tool call to scan for injection attacks…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="scan_prompt"
                checked={mode === "scan_prompt"}
                onChange={() => setMode("scan_prompt")}
                className="accent-primary"
              />
              Fast scan
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="assess_risk"
                checked={mode === "assess_risk"}
                onChange={() => setMode("assess_risk")}
                className="accent-primary"
              />
              AI risk assessment
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Scanning…" : "Scan"}
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
              {result.safe ? "Safe — no threats detected" : "Flagged — potential injection detected"}
            </span>
          </div>

          {result.riskLevel && (
            <p className="text-xs text-muted-foreground">
              Risk level:{" "}
              <span className="font-medium capitalize">{result.riskLevel}</span>
            </p>
          )}

          {result.summary && (
            <p className="text-xs text-muted-foreground">{result.summary}</p>
          )}

          {((result.detectedPatterns ?? []).length > 0 ||
            (result.threats ?? []).length > 0) && (
            <div className="text-xs">
              <p className="font-medium text-muted-foreground mb-1">Detected patterns:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {[...(result.detectedPatterns ?? []), ...(result.threats ?? [])].map(
                  (p, i) => (
                    <li key={i}>{p}</li>
                  )
                )}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground/60">Scan ID: {result.scanId}</p>
        </div>
      )}
    </div>
  );
}
