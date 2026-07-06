import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { generateDailyBrief } = await import("@/lib/daily-brief");
    const brief = await generateDailyBrief();
    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[daily-brief API]", err);
    return NextResponse.json({ error: "Erreur lors de la génération du brief" }, { status: 500 });
  }
}
