import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const round = await prisma.round.findUnique({
      where: { id: params.id },
      include: {
        cycles: {
          orderBy: { cycleNumber: "asc" },
        },
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    return NextResponse.json(round);
  } catch (error) {
    console.error("Error fetching round:", error);
    return NextResponse.json({ error: "Failed to fetch round" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { endTime, observations, totalDuration } = body;

    const updateData: any = {};
    if (endTime !== undefined) updateData.endTime = new Date(endTime);
    if (observations !== undefined) updateData.observations = observations;
    if (totalDuration !== undefined) updateData.totalDuration = totalDuration;

    const round = await prisma.round.update({
      where: { id: params.id },
      data: updateData,
      include: {
        cycles: {
          orderBy: { cycleNumber: "asc" },
        },
      },
    });

    return NextResponse.json(round);
  } catch (error) {
    console.error("Error updating round:", error);
    return NextResponse.json({ error: "Failed to update round" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.round.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting round:", error);
    return NextResponse.json({ error: "Failed to delete round" }, { status: 500 });
  }
}
