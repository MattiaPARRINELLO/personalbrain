"use server";

import { getChatHistory as storageGetChatHistory, saveChatSession as storageSaveChatSession, deleteChatSession as storageDeleteChatSession } from "@/lib/storage";
import type { ChatSession } from "@/lib/types";

export async function getChatHistory() {
  return storageGetChatHistory();
}

export async function saveChatSession(session: ChatSession) {
  return storageSaveChatSession(session);
}

export async function deleteChatSession(id: string) {
  return storageDeleteChatSession(id);
}
