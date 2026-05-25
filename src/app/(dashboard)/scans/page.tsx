import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import ScanForm from "./scan-form";

async function getAllScans(clerkId: string, email: string) {
  const user = await prisma.user.upsert({
    where: { clerkId },
    update: { email },
    create: { clerkId, email },
  });

  return prisma.mcpScan.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    low: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[severity] ?? "bg-muted text-muted-foreground"}`}
    >
      {severity}
    </span>
  );
}

export default async function ScansPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const email = user.emailAddresses[0]?.emailAddress ?? `${user.id}@clerk.dev`;
  const scans = await getAllScans(user.id, email);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Scans</h1>
        <p className="text-muted-foreground mt-1">
          Run a quick prompt injection scan or browse scan history.
        </p>
      </div>

      <ScanForm />

      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Scan History</h2>
        </div>
        {scans.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No scans yet. Use the form above to scan your first prompt.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="px-4 py-2 text-left font-medium">Input</th>
                <th className="px-4 py-2 text-left font-medium">Safe</th>
                <th className="px-4 py-2 text-left font-medium">Severity</th>
                <th className="px-4 py-2 text-left font-medium">Patterns</th>
                <th className="px-4 py-2 text-left font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-b last:border-0">
                  <td className="px-4 py-2 max-w-xs">
                    <span className="block truncate text-muted-foreground">
                      {scan.input.slice(0, 80)}
                      {scan.input.length > 80 ? "…" : ""}
                    </span>
                    {scan.aiRiskSummary && (
                      <span className="block text-xs text-muted-foreground/70 mt-0.5 italic truncate">
                        {scan.aiRiskSummary.slice(0, 80)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {scan.safe ? (
                      <span className="text-green-600 font-medium">✓ Safe</span>
                    ) : (
                      <span className="text-red-600 font-medium">✗ Flagged</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <SeverityBadge severity={scan.severity} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {scan.detectedPatterns.length === 0
                      ? "—"
                      : scan.detectedPatterns.length}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {new Date(scan.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
