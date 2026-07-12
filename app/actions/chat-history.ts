"use server";

import { getChatHistory as storageGetChatHistory, saveChatSession as storageSaveChatSession, deleteChatSession as storageDeleteChatSession } from "@/lib/storage";
import { getSession } from "@/lib/session";
import type { ChatSession } from "@/lib/types";

async function requireAuth(): Promise<void> {
  const user = await getSession();
  if (!user) {
    throw new Error("Non authentifie");
  }
}

export async function getChatHistory() {
  await requireAuth();
  return storageGetChatHistory();
}

export async function saveChatSession(session: ChatSession) {
  await requireAuth();
  return storageSaveChatSession(session);
}

export async function deleteChatSession(id: string) {
  await requireAuth();
  return storageDeleteChatSession(id);
}

export async function generateConversationTitle(content: string): Promise<string> {
  const { chatCompletion } = await import("@/lib/ai-providers");
  const { getConfig } = await import("@/lib/config");
  const config = await getConfig();
  const model = config.models.titleModel;

  const prompt = `Génère un titre très court (3-6 mots) pour cette conversation. Réponds UNIQUEMENT par le titre, sans guillemets ni préambule.

Message : "${content.slice(0, 500)}"`;

  try {
    const result = await chatCompletion(model, [
      { role: "user", content: prompt },
    ], []);
    const title = result.content.trim().replace(/^["']|["']$/g, "");
    if (title && title.length <= 80) return title;
  } catch (err) {
    console.error("Title generation failed:", err);
  }

  const cleaned = content.replace(/\s+/g, " ").trim();
  return cleaned.length <= 50 ? cleaned : cleaned.slice(0, 50).replace(/\s\S*$/, "") + "…";
}
