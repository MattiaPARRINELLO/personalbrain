import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addMemoryFact, findSimilarMemoryFacts, getMemory, logActivity } from "@/lib/storage";

const bodySchema = z.object({
  content: z.string().trim().min(1, "Le contenu est requis").max(500),
  category: z.enum(["dev", "photo", "life", "preference"]),
  confidence: z.number().min(0).max(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Payload invalide" },
        { status: 400 }
      );
    }

    const { content, category, confidence } = parsed.data;

    const existing = await findSimilarMemoryFacts(content, category);
    if (existing) {
      return NextResponse.json({ fact: existing, alreadyExisted: true });
    }

    const fact = await addMemoryFact(content, category, {
      source: "tool",
      confidence,
    });

    await logActivity("memory_added", `Mémorisé : ${content.slice(0, 80)}`, category);

    return NextResponse.json({ fact, alreadyExisted: false });
  } catch (err) {
    console.error("Memory remember error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur interne" },
      { status: 500 }
    );
  }
}
