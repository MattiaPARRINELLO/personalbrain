import type { ChatHistory, ChatSession } from "../types";
import { mutateJson, readJsonSafe, writeJsonAtomic } from "../storage-core";

const defaultChatHistory: ChatHistory = {
  sessions: [],
};

export async function getChatHistory(): Promise<ChatHistory> {
  return readJsonSafe<ChatHistory>("chat-history.json", defaultChatHistory);
}

export async function saveChatHistory(data: ChatHistory): Promise<void> {
  await writeJsonAtomic("chat-history.json", data);
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await mutateJson<ChatHistory>("chat-history.json", defaultChatHistory, (data) => {
    const idx = data.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      data.sessions[idx] = session;
    } else {
      data.sessions.push(session);
    }
  });
}

export async function deleteChatSession(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<ChatHistory>("chat-history.json", defaultChatHistory, (data) => {
    const before = data.sessions.length;
    data.sessions = data.sessions.filter((s) => s.id !== id);
    deleted = data.sessions.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
}
