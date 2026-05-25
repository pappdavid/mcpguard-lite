import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ShieldAlert, ShieldCheck, ScanLine, Activity } from "lucide-react";
import Link from "next/link";

async function getStats(clerkId: string, email: string) {
  const user = await prisma.user.upsert({
    where: { clerkId },
    update: { email },
    create: { clerkId, email },
  });

  const [total, unsafe, recent] = await Promise.all([
    prisma.mcpScan.count({ where: { userId: user.id } }),
    prisma.mcpScan.count({ where: { userId: user.id, safe: false } }),
    prisma.mcpScan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
  return { total, unsafe, safe: total - unsafe, recent };
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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const email = user.emailAddresses[0]?.emailAddress ?? `${user.id}@clerk.dev`;
  const stats = await getStats(user.id, email);

  const statCards = [
    {
      label: "Total Scans",
      value: stats.total,
      icon: ScanLine,
      color: "text-blue-500",
    },
    {
      label: "Safe",
      value: stats.safe,
      icon: ShieldCheck,
      color: "text-green-500",
    },
    {
      label: "Threats Detected",
      value: stats.unsafe,
      icon: ShieldAlert,
      color: "text-red-500",
    },
    {
      label: "Detection Rate",
      value: stats.total > 0 ? `${Math.round((stats.unsafe / stats.total) * 100)}%` : "—",
      icon: Activity,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Security Overview</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user.firstName ?? user.emailAddresses[0]?.emailAddress}.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border bg-card p-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <span className="text-2xl font-bold">{card.value}</span>
          </div>
        ))}
      </div>

      {/* Recent scans */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Recent Scans</h2>
          <Link
            href="/dashboard/scans"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all →
          </Link>
        </div>
        {stats.recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No scans yet. Use the{" "}
            <Link href="/dashboard/scans" className="underline">
              Scans
            </Link>{" "}
            tab or call the MCP API to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="px-4 py-2 text-left font-medium">Input (preview)</th>
                <th className="px-4 py-2 text-left font-medium">Safe</th>
                <th className="px-4 py-2 text-left font-medium">Severity</th>
                <th className="px-4 py-2 text-left font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((scan) => (
                <tr key={scan.id} className="border-b last:border-0">
                  <td className="px-4 py-2 max-w-xs truncate text-muted-foreground">
                    {scan.input.slice(0, 60)}
                    {scan.input.length > 60 ? "…" : ""}
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
