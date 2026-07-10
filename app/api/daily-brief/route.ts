import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { readJsonSafe } = await import("@/lib/storage");
    const data = await readJsonSafe<{ briefs: unknown[] }>("daily-briefs.json", { briefs: [] });
    const brief = data.briefs[0] ?? null;
    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[daily-brief GET]", err);
    return NextResponse.json({ brief: null });
  }
}

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
