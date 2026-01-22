import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function getTimeInterval(timestamp: number): string {
  if (timestamp < 30000) return "0-30s";
  if (timestamp < 60000) return "30-60s";
  if (timestamp < 90000) return "60-90s";
  return "90-120s";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roundId, cycleNumber, duration, hits, misses, timestamp } = body;

    const timeInterval = getTimeInterval(timestamp);

    const cycle = await prisma.cycle.create({
      data: {
        roundId,
        cycleNumber,
        duration,
        hits: hits || 0,
        misses: misses || 0,
        timestamp,
        timeInterval,
      },
    });

    return NextResponse.json(cycle);
  } catch (error) {
    console.error("Error creating cycle:", error);
    return NextResponse.json({ error: "Failed to create cycle" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, hits, misses } = body;

    const cycle = await prisma.cycle.update({
      where: { id },
      data: {
        hits: hits ?? 0,
        misses: misses ?? 0,
      },
    });

    return NextResponse.json(cycle);
  } catch (error) {
    console.error("Error updating cycle:", error);
    return NextResponse.json({ error: "Failed to update cycle" }, { status: 500 });
  }
}
