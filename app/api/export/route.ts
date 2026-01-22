import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const rounds = await prisma.round.findMany({
      include: {
        cycles: {
          orderBy: { cycleNumber: "asc" },
        },
      },
      orderBy: { startTime: "desc" },
    });

    // Build CSV content
    const headers = [
      "Round ID",
      "Data Round",
      "Duração Total (s)",
      "Observações",
      "Ciclo #",
      "Tempo Ciclo (s)",
      "Acertos",
      "Erros",
      "Timestamp (s)",
      "Intervalo",
    ];

    const rows: string[][] = [];
    
    (rounds ?? []).forEach((round) => {
      const roundCycles = round?.cycles ?? [];
      if (roundCycles?.length === 0) {
        rows.push([
          round?.id ?? "",
          new Date(round?.startTime ?? new Date()).toLocaleString("pt-BR"),
          String(Math.round((round?.totalDuration ?? 0) / 1000)),
          (round?.observations ?? "").replace(/[\n\r,]/g, " "),
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
      } else {
        roundCycles.forEach((cycle, idx) => {
          rows.push([
            idx === 0 ? (round?.id ?? "") : "",
            idx === 0 ? new Date(round?.startTime ?? new Date()).toLocaleString("pt-BR") : "",
            idx === 0 ? String(Math.round((round?.totalDuration ?? 0) / 1000)) : "",
            idx === 0 ? (round?.observations ?? "").replace(/[\n\r,]/g, " ") : "",
            String(cycle?.cycleNumber ?? ""),
            String((cycle?.duration ?? 0) / 1000),
            String(cycle?.hits ?? 0),
            String(cycle?.misses ?? 0),
            String((cycle?.timestamp ?? 0) / 1000),
            cycle?.timeInterval ?? "",
          ]);
        });
      }
    });

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="ftc_cycles_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
