import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <Link href="/dashboard" className="font-semibold text-sm">
            McpGuard Lite
          </Link>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Overview
          </Link>
          <Link href="/dashboard/scans" className="hover:text-foreground transition-colors">
            Scans
          </Link>
          <Link href="/dashboard/events" className="hover:text-foreground transition-colors">
            Events
          </Link>
          <UserButton afterSignOutUrl="/" />
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
