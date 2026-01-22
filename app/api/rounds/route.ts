import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    
    let whereClause = {};
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      whereClause = {
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };
    }

    const rounds = await prisma.round.findMany({
      where: whereClause,
      include: {
        cycles: {
          orderBy: { cycleNumber: "asc" },
        },
      },
      orderBy: { startTime: "desc" },
    });

    return NextResponse.json(rounds);
  } catch (error) {
    console.error("Error fetching rounds:", error);
    return NextResponse.json({ error: "Failed to fetch rounds" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startTime } = body;

    const round = await prisma.round.create({
      data: {
        startTime: new Date(startTime),
      },
    });

    return NextResponse.json(round);
  } catch (error) {
    console.error("Error creating round:", error);
    return NextResponse.json({ error: "Failed to create round" }, { status: 500 });
  }
}
