import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

async function getEvents(clerkId: string, email: string) {
  const user = await prisma.user.upsert({
    where: { clerkId },
    update: { email },
    create: { clerkId, email },
  });

  return prisma.securityEvent.findMany({
    where: { userId: user.id },
    orderBy: { timestamp: "desc" },
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

function EventTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    prompt_injection_detected: "Injection",
    mcp_scan_completed: "Scan",
    agent_risk_assessed: "Risk",
    auth_failure: "Auth",
  };
  return (
    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
      {labels[type] ?? type}
    </span>
  );
}

export default async function EventsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const email = user.emailAddresses[0]?.emailAddress ?? `${user.id}@clerk.dev`;
  const events = await getEvents(user.id, email);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Security Events</h1>
        <p className="text-muted-foreground mt-1">
          Audit trail of your security events across prompt scans and risk assessments.
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">
            Recent Events{" "}
            <span className="text-muted-foreground font-normal">
              (last {events.length})
            </span>
          </h2>
        </div>
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No events recorded yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Severity</th>
                <th className="px-4 py-2 text-left font-medium">Details</th>
                <th className="px-4 py-2 text-left font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <EventTypeBadge type={event.type} />
                  </td>
                  <td className="px-4 py-2">
                    <SeverityBadge severity={event.severity} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs max-w-xs truncate">
                    {JSON.stringify(event.details)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleString()}
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
