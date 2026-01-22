import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function getDateRange(range: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date = now;

  switch (range) {
    case "today":
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "7days":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30days":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "year":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case "custom":
      if (customStart && customEnd) {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
      }
      break;
  }

  return { startDate, endDate };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range");
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");

    let whereClause = {};
    
    if (range && range !== "all") {
      const { startDate, endDate } = getDateRange(range, customStart || undefined, customEnd || undefined);
      
      if (startDate) {
        whereClause = {
          startTime: {
            gte: startDate,
            lte: endDate,
          },
        };
      }
    }

    const rounds = await prisma.round.findMany({
      where: whereClause,
      include: {
        cycles: true,
      },
      orderBy: { startTime: "desc" },
    });

    const allCycles = rounds.flatMap((r) => r?.cycles ?? []);
    const completedRounds = rounds.filter((r) => r?.endTime);

    const totalRounds = completedRounds?.length ?? 0;
    const totalCycles = allCycles?.length ?? 0;
    const avgCyclesPerRound = totalRounds > 0 ? totalCycles / totalRounds : 0;
    
    const cycleDurations = allCycles?.map((c) => c?.duration ?? 0) ?? [];
    const avgCycleTime = cycleDurations?.length > 0 
      ? cycleDurations.reduce((a, b) => a + b, 0) / cycleDurations.length 
      : 0;
    const minCycleTime = cycleDurations?.length > 0 ? Math.min(...cycleDurations) : 0;
    const maxCycleTime = cycleDurations?.length > 0 ? Math.max(...cycleDurations) : 0;

    const totalHits = allCycles.reduce((sum, c) => sum + (c?.hits ?? 0), 0);
    const totalMisses = allCycles.reduce((sum, c) => sum + (c?.misses ?? 0), 0);
    const hitRate = totalHits + totalMisses > 0 
      ? (totalHits / (totalHits + totalMisses)) * 100 
      : 0;

    const intervals = ["0-30s", "30-60s", "60-90s", "90-120s"];
    const statsByInterval = intervals.map((interval) => {
      const intervalCycles = allCycles.filter((c) => c?.timeInterval === interval);
      const durations = intervalCycles?.map((c) => c?.duration ?? 0) ?? [];
      return {
        interval,
        count: intervalCycles?.length ?? 0,
        avgTime: durations?.length > 0 
          ? durations.reduce((a, b) => a + b, 0) / durations.length 
          : 0,
        hits: intervalCycles.reduce((sum, c) => sum + (c?.hits ?? 0), 0),
        misses: intervalCycles.reduce((sum, c) => sum + (c?.misses ?? 0), 0),
      };
    });

    const statsByDay: Record<string, { rounds: number; cycles: number; totalTime: number }> = {};
    completedRounds.forEach((round) => {
      const dateKey = new Date(round?.startTime ?? new Date()).toISOString().split("T")[0];
      if (!statsByDay[dateKey]) {
        statsByDay[dateKey] = { rounds: 0, cycles: 0, totalTime: 0 };
      }
      const roundCycles = round?.cycles ?? [];
      statsByDay[dateKey].rounds += 1;
      statsByDay[dateKey].cycles += roundCycles?.length ?? 0;
      statsByDay[dateKey].totalTime += roundCycles.reduce((sum, c) => sum + (c?.duration ?? 0), 0);
    });

    const dailyStats = Object.entries(statsByDay ?? {}).map(([date, data]) => ({
      date,
      rounds: data?.rounds ?? 0,
      totalCycles: data?.cycles ?? 0,
      avgCycleTime: data?.cycles > 0 ? data.totalTime / data.cycles : 0,
    })).sort((a, b) => new Date(b?.date ?? 0).getTime() - new Date(a?.date ?? 0).getTime());

    const evolutionData = completedRounds.map((round, index) => {
      const roundCycles = round?.cycles ?? [];
      const durations = roundCycles?.map((c) => c?.duration ?? 0) ?? [];
      return {
        roundNumber: completedRounds?.length - index,
        date: new Date(round?.startTime ?? new Date()).toLocaleDateString("pt-BR"),
        avgTime: durations?.length > 0 
          ? durations.reduce((a, b) => a + b, 0) / durations.length 
          : 0,
        cycleCount: roundCycles?.length ?? 0,
        hits: roundCycles.reduce((sum, c) => sum + (c?.hits ?? 0), 0),
        misses: roundCycles.reduce((sum, c) => sum + (c?.misses ?? 0), 0),
      };
    }).reverse();

    return NextResponse.json({
      general: {
        totalRounds,
        totalCycles,
        avgCyclesPerRound: Math.round(avgCyclesPerRound * 10) / 10,
        avgCycleTime: Math.round(avgCycleTime),
        minCycleTime,
        maxCycleTime,
        totalHits,
        totalMisses,
        hitRate: Math.round(hitRate * 10) / 10,
      },
      statsByInterval,
      dailyStats,
      evolutionData,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}