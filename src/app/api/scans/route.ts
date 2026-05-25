import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId, email: `${clerkId}@clerk.dev` },
  });
  const userFilter = { userId: user.id };

  const [scans, events, total, unsafe] = await Promise.all([
    prisma.mcpScan.findMany({
      where: userFilter,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.securityEvent.findMany({
      where: userFilter,
      orderBy: { timestamp: "desc" },
      take: 10,
    }),
    prisma.mcpScan.count({ where: userFilter }),
    prisma.mcpScan.count({ where: { ...userFilter, safe: false } }),
  ]);

  return NextResponse.json({
    scans,
    events,
    stats: {
      totalScans: total,
      reportsRequiringReview: unsafe,
      safeScans: total - unsafe,
    },
  });
}
